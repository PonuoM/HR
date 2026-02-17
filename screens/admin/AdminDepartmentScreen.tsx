import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment, getPositions, createPosition, updatePosition, deletePosition } from '../../services/api';
import { useToast } from '../../components/Toast';

interface Department {
    id: number;
    name: string;
    work_start_time: string;
    work_end_time: string;
    work_hours_per_day: string;
    is_admin_system: number;
}

interface Position {
    id: number;
    name: string;
    can_have_subordinates: number;
}

type Tab = 'departments' | 'positions';

const AdminDepartmentScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [tab, setTab] = useState<Tab>('departments');

    // === Department state ===
    const { data: departments, refetch: refetchDepts } = useApi(() => getDepartments(), []);
    const [deptEditId, setDeptEditId] = useState<number | null>(null);
    const [showDeptAdd, setShowDeptAdd] = useState(false);
    const [deptForm, setDeptForm] = useState({ name: '', work_start_time: '09:00', work_end_time: '17:00', is_admin_system: 0 });
    const [deptSaving, setDeptSaving] = useState(false);
    const [deletingDept, setDeletingDept] = useState<number | null>(null);

    // === Position state ===
    const { data: positions, refetch: refetchPos } = useApi(() => getPositions(), []);
    const [posEditId, setPosEditId] = useState<number | null>(null);
    const [showPosAdd, setShowPosAdd] = useState(false);
    const [posForm, setPosForm] = useState({ name: '', can_have_subordinates: 0 });
    const [posSaving, setPosSaving] = useState(false);
    const [deletingPos, setDeletingPos] = useState<number | null>(null);

    // Confirm delete state
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'dept' | 'pos'; id: number; name: string } | null>(null);

    const calcHours = (start: string, end: string) => {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        return diff > 0 ? (diff / 60).toFixed(1) : '0';
    };

    // === Department handlers ===
    const openDeptEdit = (dept: Department) => {
        setDeptEditId(dept.id);
        setShowDeptAdd(false);
        setDeptForm({
            name: dept.name,
            work_start_time: dept.work_start_time?.substring(0, 5) || '09:00',
            work_end_time: dept.work_end_time?.substring(0, 5) || '17:00',
            is_admin_system: dept.is_admin_system || 0,
        });
    };

    const openDeptAdd = () => {
        setDeptEditId(null);
        setShowDeptAdd(true);
        setDeptForm({ name: '', work_start_time: '09:00', work_end_time: '17:00', is_admin_system: 0 });
    };

    const handleDeptSave = async () => {
        if (!deptForm.name.trim()) return;
        setDeptSaving(true);
        try {
            const data = {
                name: deptForm.name.trim(),
                work_start_time: deptForm.work_start_time + ':00',
                work_end_time: deptForm.work_end_time + ':00',
                is_admin_system: deptForm.is_admin_system,
            };
            if (showDeptAdd) {
                await createDepartment(data);
                toast('เพิ่มแผนกเรียบร้อย', 'success');
            } else if (deptEditId) {
                await updateDepartment(deptEditId, data);
                toast('บันทึกเรียบร้อย', 'success');
            }
            setDeptEditId(null);
            setShowDeptAdd(false);
            refetchDepts();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setDeptSaving(false);
        }
    };

    const handleDeptDelete = async (id: number) => {
        setDeletingDept(id);
        try {
            await deleteDepartment(id);
            toast('ลบแผนกเรียบร้อย', 'success');
            refetchDepts();
        } catch (err: any) {
            toast(err.message || 'ไม่สามารถลบได้', 'error');
        } finally {
            setDeletingDept(null);
            setConfirmDelete(null);
        }
    };

    // === Position handlers ===
    const openPosEdit = (pos: Position) => {
        setPosEditId(pos.id);
        setShowPosAdd(false);
        setPosForm({ name: pos.name, can_have_subordinates: pos.can_have_subordinates || 0 });
    };

    const openPosAdd = () => {
        setPosEditId(null);
        setShowPosAdd(true);
        setPosForm({ name: '', can_have_subordinates: 0 });
    };

    const handlePosSave = async () => {
        if (!posForm.name.trim()) return;
        setPosSaving(true);
        try {
            const data = { name: posForm.name.trim(), can_have_subordinates: posForm.can_have_subordinates };
            if (showPosAdd) {
                await createPosition(data);
                toast('เพิ่มตำแหน่งเรียบร้อย', 'success');
            } else if (posEditId) {
                await updatePosition(posEditId, data);
                toast('บันทึกเรียบร้อย', 'success');
            }
            setPosEditId(null);
            setShowPosAdd(false);
            refetchPos();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setPosSaving(false);
        }
    };

    const handlePosDelete = async (id: number) => {
        setDeletingPos(id);
        try {
            await deletePosition(id);
            toast('ลบตำแหน่งเรียบร้อย', 'success');
            refetchPos();
        } catch (err: any) {
            toast(err.message || 'ไม่สามารถลบได้', 'error');
        } finally {
            setDeletingPos(null);
            setConfirmDelete(null);
        }
    };

    const inputCls = "w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50";

    // ================ Department form fields ================
    const deptFormFields = (
        <div className="space-y-3 animate-in fade-in">
            <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">ชื่อแผนก</label>
                <input type="text" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} className={inputCls} placeholder="เช่น ฝ่ายบัญชี" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">เวลาเข้างาน</label>
                    <input type="time" value={deptForm.work_start_time} onChange={(e) => setDeptForm({ ...deptForm, work_start_time: e.target.value })} className={inputCls} />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">เวลาออกงาน</label>
                    <input type="time" value={deptForm.work_end_time} onChange={(e) => setDeptForm({ ...deptForm, work_end_time: e.target.value })} className={inputCls} />
                </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
                <span className="material-icons-round text-sm">calculate</span>
                รวม {calcHours(deptForm.work_start_time, deptForm.work_end_time)} ชั่วโมง/วัน
            </div>
            {/* Admin system toggle */}
            <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-sm text-amber-500">admin_panel_settings</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300">จัดการหลังบ้านได้</span>
                </div>
                <button
                    type="button"
                    onClick={() => setDeptForm({ ...deptForm, is_admin_system: deptForm.is_admin_system ? 0 : 1 })}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${deptForm.is_admin_system ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${deptForm.is_admin_system ? 'translate-x-5' : ''}`} />
                </button>
            </div>
            <div className="flex gap-2 pt-1">
                <button onClick={tab === 'departments' ? handleDeptSave : undefined} disabled={deptSaving} className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all">
                    {deptSaving ? <span className="material-icons-round animate-spin text-sm">autorenew</span> : <span className="material-icons-round text-sm">save</span>}
                    {deptSaving ? 'กำลังบันทึก...' : showDeptAdd ? 'เพิ่มแผนก' : 'บันทึก'}
                </button>
                <button onClick={() => { setDeptEditId(null); setShowDeptAdd(false); }} className="px-4 py-2.5 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    ยกเลิก
                </button>
            </div>
        </div>
    );

    // ================ Position form fields ================
    const posFormFields = (
        <div className="space-y-3 animate-in fade-in">
            <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">ชื่อตำแหน่ง</label>
                <input type="text" value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} className={inputCls} placeholder="เช่น ผู้จัดการ" />
            </div>
            <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-sm text-purple-500">supervisor_account</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300">มีลูกน้องได้</span>
                </div>
                <button
                    type="button"
                    onClick={() => setPosForm({ ...posForm, can_have_subordinates: posForm.can_have_subordinates ? 0 : 1 })}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${posForm.can_have_subordinates ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${posForm.can_have_subordinates ? 'translate-x-5' : ''}`} />
                </button>
            </div>
            <div className="flex gap-2 pt-1">
                <button onClick={handlePosSave} disabled={posSaving} className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all">
                    {posSaving ? <span className="material-icons-round animate-spin text-sm">autorenew</span> : <span className="material-icons-round text-sm">save</span>}
                    {posSaving ? 'กำลังบันทึก...' : showPosAdd ? 'เพิ่มตำแหน่ง' : 'บันทึก'}
                </button>
                <button onClick={() => { setPosEditId(null); setShowPosAdd(false); }} className="px-4 py-2.5 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    ยกเลิก
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            {/* Header */}
            <header className="bg-white dark:bg-[#15202b] pt-4 pb-4 px-4 md:px-6 shadow-sm z-20 flex justify-between items-center sticky top-0 md:bg-white/90 md:backdrop-blur-md">
                <button onClick={() => navigate('/profile')} className="text-slate-500 dark:text-slate-400 md:hidden active:opacity-70 flex items-center gap-1">
                    <span className="material-icons-round text-lg">arrow_back</span>
                    <span className="text-sm font-medium">กลับ</span>
                </button>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-icons-round text-primary">apartment</span>
                    จัดการแผนกและตำแหน่ง
                </h1>
                <div className="w-16"></div>
            </header>

            {/* Tabs */}
            <div className="bg-white dark:bg-[#15202b] border-b border-gray-100 dark:border-gray-800 px-4 md:px-6 sticky top-[56px] z-10">
                <div className="flex gap-0 max-w-3xl mx-auto">
                    {([
                        { key: 'departments' as Tab, label: 'แผนก', icon: 'apartment', count: (departments || []).length },
                        { key: 'positions' as Tab, label: 'ตำแหน่ง', icon: 'badge', count: (positions || []).length },
                    ]).map((t) => (
                        <button
                            key={t.key}
                            onClick={() => { setTab(t.key); setDeptEditId(null); setPosEditId(null); setShowDeptAdd(false); setShowPosAdd(false); }}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${tab === t.key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                        >
                            <span className="material-icons-round text-base">{t.icon}</span>
                            {t.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>{t.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            <main className="flex-1 overflow-y-auto scrollbar-hide px-4 md:px-6 py-6">
                <div className="max-w-3xl mx-auto space-y-4">

                    {/* ==================== DEPARTMENTS TAB ==================== */}
                    {tab === 'departments' && (
                        <>
                            {/* Info Banner */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                                <span className="material-icons-round text-blue-600 text-lg mt-0.5">info</span>
                                <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                    <p className="font-semibold mb-1">เวลาทำงานของแผนก</p>
                                    <p>กำหนดเวลาเข้า-ออกงานของแต่ละแผนก ระบบจะนำไปใช้คำนวณวันลาและ auto set เวลาในฟอร์มใบลาให้ตามแผนกโดยอัตโนมัติ</p>
                                </div>
                            </div>

                            {/* Add Department Button */}
                            <div className="flex justify-end">
                                <button onClick={openDeptAdd} className="bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-hover transition-all flex items-center gap-2 shadow-sm">
                                    <span className="material-icons-round text-base">add</span>
                                    เพิ่มแผนก
                                </button>
                            </div>

                            {/* Add Form */}
                            {showDeptAdd && (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-primary/30 overflow-hidden p-5">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-icons-round text-primary text-base">add_circle</span>
                                        เพิ่มแผนกใหม่
                                    </h3>
                                    {deptFormFields}
                                </div>
                            )}

                            {/* Department List */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-icons-round text-base text-primary">list</span>
                                        แผนกทั้งหมด ({(departments || []).length})
                                    </h2>
                                </div>

                                {(departments || []).length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <span className="material-icons-round text-4xl mb-2 block">domain_disabled</span>
                                        <p className="text-sm">ยังไม่มีข้อมูลแผนก</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                                        {(departments || []).map((dept: Department) => (
                                            <div key={dept.id} className="px-5 py-4">
                                                {deptEditId === dept.id ? (
                                                    deptFormFields
                                                ) : (
                                                    <div className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                                                                <span className="material-icons-round text-blue-600 dark:text-blue-400 text-lg">apartment</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{dept.name}</p>
                                                                    {dept.is_admin_system ? (
                                                                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>
                                                                    ) : null}
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-0.5">
                                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                        <span className="material-icons-round text-[11px] text-green-500">login</span>
                                                                        {dept.work_start_time?.substring(0, 5) || '09:00'}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">→</span>
                                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                        <span className="material-icons-round text-[11px] text-red-400">logout</span>
                                                                        {dept.work_end_time?.substring(0, 5) || '17:00'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                                                                        {dept.work_hours_per_day || '8'} ชม./วัน
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 ml-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => openDeptEdit(dept)} className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all" title="แก้ไข">
                                                                <span className="material-icons-round text-lg">edit</span>
                                                            </button>
                                                            <button onClick={() => setConfirmDelete({ type: 'dept', id: dept.id, name: dept.name })} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="ลบ">
                                                                <span className="material-icons-round text-lg">delete_outline</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ==================== POSITIONS TAB ==================== */}
                    {tab === 'positions' && (
                        <>
                            {/* Info Banner */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30 flex items-start gap-3">
                                <span className="material-icons-round text-purple-600 text-lg mt-0.5">info</span>
                                <div className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
                                    <p className="font-semibold mb-1">ตำแหน่งงาน</p>
                                    <p>กำหนดตำแหน่งงานและระบุว่าตำแหน่งไหนสามารถมีลูกน้องได้ (หัวหน้า/ผู้จัดการ) เพื่อใช้ในระบบอนุมัติและรายงาน</p>
                                </div>
                            </div>

                            {/* Add Position Button */}
                            <div className="flex justify-end">
                                <button onClick={openPosAdd} className="bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-hover transition-all flex items-center gap-2 shadow-sm">
                                    <span className="material-icons-round text-base">add</span>
                                    เพิ่มตำแหน่ง
                                </button>
                            </div>

                            {/* Add Form */}
                            {showPosAdd && (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-primary/30 overflow-hidden p-5">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-icons-round text-primary text-base">add_circle</span>
                                        เพิ่มตำแหน่งใหม่
                                    </h3>
                                    {posFormFields}
                                </div>
                            )}

                            {/* Position List */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-icons-round text-base text-primary">list</span>
                                        ตำแหน่งทั้งหมด ({(positions || []).length})
                                    </h2>
                                </div>

                                {(positions || []).length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <span className="material-icons-round text-4xl mb-2 block">badge</span>
                                        <p className="text-sm">ยังไม่มีข้อมูลตำแหน่ง</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                                        {(positions || []).map((pos: Position) => (
                                            <div key={pos.id} className="px-5 py-4">
                                                {posEditId === pos.id ? (
                                                    posFormFields
                                                ) : (
                                                    <div className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pos.can_have_subordinates ? 'bg-gradient-to-br from-purple-500/10 to-pink-500/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                                                <span className={`material-icons-round text-lg ${pos.can_have_subordinates ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                                                                    {pos.can_have_subordinates ? 'supervisor_account' : 'person'}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{pos.name}</p>
                                                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                                    {pos.can_have_subordinates ? (
                                                                        <><span className="material-icons-round text-[11px] text-purple-400">check_circle</span> มีลูกน้องได้</>
                                                                    ) : (
                                                                        <><span className="material-icons-round text-[11px] text-gray-400">remove_circle_outline</span> ไม่มีลูกน้อง</>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 ml-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => openPosEdit(pos)} className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all" title="แก้ไข">
                                                                <span className="material-icons-round text-lg">edit</span>
                                                            </button>
                                                            <button onClick={() => setConfirmDelete({ type: 'pos', id: pos.id, name: pos.name })} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="ลบ">
                                                                <span className="material-icons-round text-lg">delete_outline</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* Delete Confirmation Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="text-center mb-4">
                            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                                <span className="material-icons-round text-3xl text-red-500">delete_forever</span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">ยืนยันการลบ</h3>
                            <p className="text-sm text-slate-500">
                                ต้องการลบ{confirmDelete.type === 'dept' ? 'แผนก' : 'ตำแหน่ง'} "<span className="font-semibold text-slate-700 dark:text-slate-300">{confirmDelete.name}</span>" หรือไม่?
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => confirmDelete.type === 'dept' ? handleDeptDelete(confirmDelete.id) : handlePosDelete(confirmDelete.id)}
                                disabled={deletingDept !== null || deletingPos !== null}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                {(deletingDept || deletingPos) ? <span className="material-icons-round animate-spin text-sm">autorenew</span> : <span className="material-icons-round text-sm">delete</span>}
                                ลบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDepartmentScreen;
