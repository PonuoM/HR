import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLeaveType } from '../../types';
import { useApi } from '../../hooks/useApi';
import { getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType as apiDeleteLeaveType, uploadFile } from '../../services/api';
import { useToast } from '../../components/Toast';
import CustomSelect from '../../components/CustomSelect';

const AdminQuotaScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast, confirm: showConfirm } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: rawLeaveTypes, loading, refetch } = useApi(() => getLeaveTypes(), []);

    const leaveTypes: AdminLeaveType[] = (rawLeaveTypes || []).map((lt: any) => ({
        id: lt.id,
        name: lt.name,
        defaultQuota: Number(lt.default_quota || lt.defaultQuota || 0),
        unit: lt.unit || 'days',
        type: lt.type || 'annual',
        resetCycle: lt.reset_cycle || 'year',
        color: lt.color || 'blue',
        icon: lt.icon || 'star',
        iconUrl: lt.icon_url || null,
        isActive: lt.is_active !== undefined ? !!lt.is_active : true,
        requiresDoc: lt.requires_doc !== undefined ? !!lt.requires_doc : false,
        probationMonths: Number(lt.probation_months ?? 0),
        grantTiming: lt.grant_timing || 'next_year',
        prorateFirstYear: lt.prorate_first_year !== undefined ? !!lt.prorate_first_year : true,
        advanceNoticeDays: Number(lt.advance_notice_days ?? 0),
        seniorityTiers: (lt.seniority_tiers || []).map((t: any) => ({ minYears: Number(t.min_years), days: Number(t.days) })),
    }));

    // Form state
    const emptyForm: Partial<AdminLeaveType> = {
        name: '', defaultQuota: 0, unit: 'days', type: 'annual', color: 'blue', icon: 'star', iconUrl: null,
        isActive: true, requiresDoc: false, probationMonths: 0, grantTiming: 'next_year',
        prorateFirstYear: true, advanceNoticeDays: 0, seniorityTiers: [],
    };
    const [formData, setFormData] = useState<Partial<AdminLeaveType>>(emptyForm);

    const handleEdit = (item: AdminLeaveType) => {
        setFormData({ ...item });
        setEditingId(item.id);
        setShowModal(true);
    };

    const handleAddNew = () => {
        setFormData({ ...emptyForm });
        setEditingId(null);
        setShowModal(true);
    };

    // Icon upload handler
    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setUploading(true);
            const result = await uploadFile(file, 'leave_icon');
            setFormData({ ...formData, iconUrl: result.url, icon: '' });
        } catch (err) {
            toast('อัพโหลดไม่สำเร็จ: ' + (err as Error).message, 'error');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveIcon = () => {
        setFormData({ ...formData, iconUrl: null, icon: 'star' });
    };

    const handleSave = async () => {
        const payload: any = {
            name: formData.name,
            default_quota: formData.defaultQuota,
            unit: formData.unit,
            type: formData.type,
            color: formData.color,
            icon: formData.icon || 'star',
            icon_url: formData.iconUrl || null,
            is_active: formData.isActive ? 1 : 0,
            requires_doc: formData.requiresDoc ? 1 : 0,
            probation_months: formData.probationMonths || 0,
            grant_timing: formData.grantTiming || 'next_year',
            prorate_first_year: formData.prorateFirstYear ? 1 : 0,
            advance_notice_days: formData.advanceNoticeDays || 0,
        };
        if (formData.type === 'seniority') {
            payload.seniority_tiers = (formData.seniorityTiers || []).map(t => ({
                min_years: t.minYears,
                days: t.days,
            }));
        }
        try {
            if (editingId) {
                await updateLeaveType(editingId, payload);
            } else {
                await createLeaveType(payload);
            }
            setShowModal(false);
            refetch();
        } catch (err) {
            toast('เกิดข้อผิดพลาด: ' + (err as Error).message, 'error');
        }
    };

    const handleDelete = async (id: number) => {
        if (await showConfirm({ message: 'ยืนยันการลบประเภทการลานี้?', type: 'danger', confirmText: 'ลบ' })) {
            try {
                await apiDeleteLeaveType(id);
                refetch();
            } catch (err) {
                toast('เกิดข้อผิดพลาด: ' + (err as Error).message, 'error');
            }
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'annual': return 'รายปี (Reset ทุกปี)';
            case 'seniority': return 'ตามอายุงาน (ขั้นบันได)';
            case 'lifetime': return 'ตลอดอายุงาน (ใช้แล้วหมดไป)';
            case 'unpaid': return 'ไม่จำกัด (หักเงิน)';
            default: return type;
        }
    };

    // Seniority tier helpers
    const addTier = () => {
        const tiers = [...(formData.seniorityTiers || [])];
        const lastYear = tiers.length > 0 ? tiers[tiers.length - 1].minYears + 1 : 1;
        tiers.push({ minYears: lastYear, days: 6 });
        setFormData({ ...formData, seniorityTiers: tiers });
    };
    const removeTier = (idx: number) => {
        const tiers = [...(formData.seniorityTiers || [])];
        tiers.splice(idx, 1);
        setFormData({ ...formData, seniorityTiers: tiers });
    };
    const updateTier = (idx: number, field: 'minYears' | 'days', value: number) => {
        const tiers = [...(formData.seniorityTiers || [])];
        tiers[idx] = { ...tiers[idx], [field]: value };
        setFormData({ ...formData, seniorityTiers: tiers });
    };

    // Render icon: PNG if iconUrl exists, else Material Icon
    const renderIcon = (item: { icon: string; iconUrl: string | null; color: string }, size: 'sm' | 'lg' = 'lg') => {
        const sizeClass = size === 'lg' ? 'w-14 h-14 rounded-2xl text-3xl' : 'w-8 h-8 rounded-lg text-lg';
        const imgSize = size === 'lg' ? 'w-9 h-9' : 'w-5 h-5';
        if (item.iconUrl) {
            return (
                <div className={`${sizeClass} bg-${item.color}-100 dark:bg-${item.color}-900/20 flex items-center justify-center shadow-sm`}>
                    <img src={item.iconUrl} alt="icon" className={`${imgSize} object-contain`} />
                </div>
            );
        }
        return (
            <div className={`${sizeClass} bg-${item.color}-100 dark:bg-${item.color}-900/20 text-${item.color}-600 dark:text-${item.color}-400 flex items-center justify-center shadow-sm`}>
                <span className="material-icons-round">{item.icon}</span>
            </div>
        );
    };

    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto min-h-full">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">ตั้งค่าโควต้าวันลา</h1>
                        <p className="text-xs md:text-base text-gray-500 dark:text-gray-400">จัดการประเภทการลา กฎระเบียบ และจำนวนวัน</p>
                    </div>
                </div>
                <button onClick={handleAddNew} className="w-full md:w-auto bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-95">
                    <span className="material-icons-round text-xl">add_circle</span>
                    เพิ่มประเภทการลา
                </button>
            </header>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {leaveTypes.map((item) => (
                    <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-all ${!item.isActive ? 'opacity-60 grayscale' : ''}`}>
                        <div className={`absolute top-4 right-4 px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500'}`}>
                            {item.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </div>

                        <div className="flex items-start gap-4 mb-4">
                            {renderIcon(item)}
                            <div className="pt-1">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight mb-1">{item.name}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <span className="material-icons-round text-[14px]">info</span>
                                    {getTypeLabel(item.type)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700/50 mb-3 grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">
                                    {item.type === 'seniority' ? 'ขั้นบันได' : 'จำนวนมาตรฐาน'}
                                </p>
                                {item.type === 'seniority' && item.seniorityTiers.length > 0 ? (
                                    <div className="space-y-0.5">
                                        {item.seniorityTiers.map((t, i) => (
                                            <p key={i} className="text-xs text-gray-700 dark:text-gray-300">
                                                <span className="font-semibold">{t.minYears}+ ปี</span> → {t.days} วัน
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-900 dark:text-white font-semibold text-lg">
                                        {item.defaultQuota} <span className="text-sm font-normal text-gray-500">{item.unit === 'days' ? 'วัน' : 'ชม.'}</span>
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">หลักฐานแนบ</p>
                                <p className={`text-sm font-semibold flex items-center gap-1 ${item.requiresDoc ? 'text-orange-500' : 'text-gray-500'}`}>
                                    {item.requiresDoc ? (
                                        <><span className="material-icons-round text-sm">attach_file</span> จำเป็น</>
                                    ) : (
                                        <><span className="material-icons-round text-sm">do_not_disturb</span> ไม่ต้อง</>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Extra info badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {item.probationMonths > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                    <span className="material-icons-round text-[12px]">hourglass_top</span> ทดลองงาน {item.probationMonths} เดือน
                                </span>
                            )}
                            {item.advanceNoticeDays > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                    <span className="material-icons-round text-[12px]">schedule</span> ล่วงหน้า {item.advanceNoticeDays} วัน
                                </span>
                            )}
                            {item.type === 'seniority' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                                    <span className="material-icons-round text-[12px]">emoji_events</span>
                                    {item.grantTiming === 'immediate' ? 'ได้ทันที (prorate)' : 'ปีถัดไปค่อยได้'}
                                </span>
                            )}
                        </div>

                        <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                            <button onClick={() => handleEdit(item)} className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2">
                                <span className="material-icons-round text-lg">edit</span> แก้ไข
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                                <span className="material-icons-round text-lg">delete</span>
                            </button>
                        </div>
                    </div>
                ))}

                <button onClick={handleAddNew} className="hidden md:flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl p-5 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[200px]">
                    <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <span className="material-icons-round text-3xl text-gray-400 group-hover:text-primary">add</span>
                    </div>
                    <p className="font-medium text-gray-500 group-hover:text-primary">เพิ่มประเภทการลาใหม่</p>
                </button>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 w-full md:w-[560px] rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slide-up md:animate-scale-in">
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-icons-round text-primary">{editingId ? 'edit_note' : 'add_circle'}</span>
                                {editingId ? 'แก้ไขข้อมูล' : 'เพิ่มประเภทการลา'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                <span className="material-icons-round text-gray-500">close</span>
                            </button>
                        </div>

                        <div className="p-4 md:p-6 overflow-y-auto space-y-5 flex-1">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อประเภทการลา</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="เช่น ลาพักร้อน" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none dark:text-white" />
                            </div>

                            {/* Icon Upload / Select */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ไอคอน</label>
                                <div className="flex items-center gap-4">
                                    {/* Preview */}
                                    <div className="shrink-0">
                                        {formData.iconUrl ? (
                                            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 relative group/icon">
                                                <img src={formData.iconUrl} alt="icon" className="w-10 h-10 object-contain" />
                                                <button onClick={handleRemoveIcon} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-opacity">
                                                    <span className="material-icons-round text-xs">close</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={`w-16 h-16 rounded-2xl bg-${formData.color}-100 dark:bg-${formData.color}-900/20 text-${formData.color}-600 dark:text-${formData.color}-400 flex items-center justify-center text-3xl border-2 border-dashed border-gray-200 dark:border-gray-700`}>
                                                <span className="material-icons-round">{formData.icon || 'star'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        {/* Upload button */}
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                            <span className="material-icons-round text-lg">{uploading ? 'hourglass_empty' : 'upload'}</span>
                                            {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดรูปไอคอน'}
                                        </button>

                                        {/* Fallback Material Icon selector */}
                                        {!formData.iconUrl && (
                                            <CustomSelect
                                                value={formData.icon}
                                                onChange={(val) => setFormData({ ...formData, icon: val })}
                                                options={[
                                                    { value: 'beach_access', label: '🏖 Beach' },
                                                    { value: 'local_hospital', label: '🏥 Health' },
                                                    { value: 'business_center', label: '💼 Work' },
                                                    { value: 'star', label: '⭐ Star' },
                                                    { value: 'pregnant_woman', label: '👶 Family' },
                                                    { value: 'money_off', label: '💰 Money' },
                                                    { value: 'school', label: '🎓 Education' },
                                                    { value: 'military_tech', label: '🎖 Military' },
                                                ]}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">สีธีม</label>
                                <div className="flex gap-2">
                                    {['blue', 'green', 'orange', 'red', 'purple', 'pink', 'gray'].map(c => (
                                        <button key={c} onClick={() => setFormData({ ...formData, color: c })} className={`w-8 h-8 rounded-full bg-${c}-500 border-2 transition-all ${formData.color === c ? 'border-gray-900 dark:border-white scale-110 ring-2 ring-offset-2 ring-gray-300' : 'border-transparent'}`} />
                                    ))}
                                </div>
                            </div>

                            {/* Quota & Unit */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">จำนวนมาตรฐาน (ต่อปี)</label>
                                    <input type="number" value={formData.defaultQuota} onChange={(e) => setFormData({ ...formData, defaultQuota: Number(e.target.value) })} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หน่วยนับ</label>
                                    <CustomSelect
                                        value={formData.unit}
                                        onChange={(val) => setFormData({ ...formData, unit: val as any })}
                                        options={[
                                            { value: 'days', label: 'วัน (Days)' },
                                            { value: 'hours', label: 'ชั่วโมง (Hours)' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Type Logic */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">เงื่อนไขโควต้า</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { val: 'annual', label: 'รีเซ็ตรายปี' },
                                        { val: 'seniority', label: 'ตามอายุงาน' },
                                        { val: 'lifetime', label: 'ครั้งเดียวตลอดชีพ' },
                                        { val: 'unpaid', label: 'ไม่จำกัด (No Pay)' }
                                    ].map((t) => (
                                        <button key={t.val} onClick={() => setFormData({ ...formData, type: t.val as any })} className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${formData.type === t.val ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Seniority Tiers ── */}
                            {formData.type === 'seniority' && (
                                <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-200 dark:border-orange-900/30 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                                            <span className="material-icons-round text-lg">emoji_events</span>
                                            ขั้นบันไดตามอายุงาน
                                        </label>
                                        <button onClick={addTier} className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-lg font-medium hover:bg-orange-200 transition-colors flex items-center gap-1">
                                            <span className="material-icons-round text-sm">add</span> เพิ่มขั้น
                                        </button>
                                    </div>

                                    {(formData.seniorityTiers || []).length === 0 && (
                                        <p className="text-xs text-orange-500 text-center py-2">ยังไม่มีขั้นบันได กดปุ่ม "เพิ่มขั้น" ด้านบน</p>
                                    )}

                                    {(formData.seniorityTiers || []).map((tier, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                <div className="relative">
                                                    <input type="number" min={0} value={tier.minYears} onChange={(e) => updateTier(idx, 'minYears', Number(e.target.value))} className="w-full bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 text-sm outline-none dark:text-white pr-10" />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">ปี+</span>
                                                </div>
                                                <div className="relative">
                                                    <input type="number" min={0} value={tier.days} onChange={(e) => updateTier(idx, 'days', Number(e.target.value))} className="w-full bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 text-sm outline-none dark:text-white pr-8" />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">วัน</span>
                                                </div>
                                            </div>
                                            <button onClick={() => removeTier(idx)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors shrink-0">
                                                <span className="material-icons-round text-lg">close</span>
                                            </button>
                                        </div>
                                    ))}

                                    {/* Probation & Grant */}
                                    <div className="border-t border-orange-200 dark:border-orange-900/30 pt-3 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">ทดลองงาน (เดือน)</label>
                                                <input type="number" min={0} value={formData.probationMonths || 0} onChange={(e) => setFormData({ ...formData, probationMonths: Number(e.target.value) })} className="w-full bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 text-sm outline-none dark:text-white" placeholder="0 = ไม่มี" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">ได้สิทธิ์เมื่อ</label>
                                                <CustomSelect
                                                    value={formData.grantTiming || 'next_year'}
                                                    onChange={(val) => setFormData({ ...formData, grantTiming: val as any })}
                                                    options={[
                                                        { value: 'immediate', label: 'ได้ทันที (Prorate)' },
                                                        { value: 'next_year', label: 'ปีถัดไป' },
                                                    ]}
                                                />
                                            </div>
                                        </div>

                                        {formData.grantTiming === 'immediate' && (
                                            <label className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 cursor-pointer">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">คิดตามสัดส่วน (Prorate)</span>
                                                <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${formData.prorateFirstYear ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => setFormData({ ...formData, prorateFirstYear: !formData.prorateFirstYear })}>
                                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${formData.prorateFirstYear ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                </div>
                                            </label>
                                        )}

                                        <p className="text-[10px] text-orange-500/80 leading-relaxed">
                                            {formData.grantTiming === 'immediate'
                                                ? '* ผ่านทดลองงานแล้วได้สิทธิ์ทันที คิดตามสัดส่วนเดือนที่เหลือ'
                                                : '* ผ่านทดลองงานแล้วจะได้สิทธิ์ในปีถัดไปเต็มจำนวน'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Advance Notice */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ต้องลาล่วงหน้า (วัน)</label>
                                <input type="number" min={0} value={formData.advanceNoticeDays || 0} onChange={(e) => setFormData({ ...formData, advanceNoticeDays: Number(e.target.value) })} placeholder="0 = ไม่ต้อง" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none dark:text-white" />
                                <p className="text-[10px] text-gray-400 mt-1">0 = ไม่ต้องลาล่วงหน้า</p>
                            </div>

                            {/* Toggles */}
                            <div className="space-y-3 pt-2">
                                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 cursor-pointer">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ต้องแนบใบรับรองแพทย์/หลักฐาน</span>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.requiresDoc ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => setFormData({ ...formData, requiresDoc: !formData.requiresDoc })}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${formData.requiresDoc ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 cursor-pointer">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">เปิดใช้งานในระบบ</span>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex gap-3 shrink-0">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">ยกเลิก</button>
                            <button onClick={handleSave} className="flex-1 bg-primary text-white py-3 rounded-xl font-medium shadow-lg shadow-primary/30">บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminQuotaScreen;