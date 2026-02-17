import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getCompanies, createCompany, updateCompany, toggleCompanyActive } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';

interface Company {
    id: number;
    code: string;
    name: string;
    logo_url: string | null;
    is_active: boolean;
    employee_count: number;
    created_at: string;
}

const AdminCompanyScreen: React.FC = () => {
    const navigate = useNavigate();
    const { isSuperAdmin, company: activeCompany, setActiveCompany } = useAuth();
    const { toast, confirm: showConfirm } = useToast();
    const { data: companies, loading, refetch } = useApi(() => getCompanies(), []);

    const [showModal, setShowModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [form, setForm] = useState({ code: '', name: '', logo_url: '' });
    const [saving, setSaving] = useState(false);

    // Only superadmin can access
    if (!isSuperAdmin) {
        return (
            <div className="pt-6 md:pt-8 pb-24 md:pb-8 px-4 md:px-8 max-w-5xl mx-auto min-h-full font-display flex items-center justify-center">
                <div className="text-center">
                    <span className="material-icons-round text-5xl text-red-300 dark:text-red-600 mb-3 block">lock</span>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">เฉพาะ Superadmin เท่านั้น</p>
                    <button onClick={() => navigate('/profile')} className="mt-4 text-primary font-semibold text-sm">← กลับหน้าโปรไฟล์</button>
                </div>
            </div>
        );
    }

    const openCreate = () => {
        setEditingCompany(null);
        setForm({ code: '', name: '', logo_url: '' });
        setShowModal(true);
    };

    const openEdit = (c: Company) => {
        setEditingCompany(c);
        setForm({ code: c.code, name: c.name, logo_url: c.logo_url || '' });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.code || !form.name) {
            toast('กรุณากรอกรหัสและชื่อบริษัท', 'warning');
            return;
        }
        setSaving(true);
        try {
            if (editingCompany) {
                await updateCompany(editingCompany.id, {
                    code: form.code,
                    name: form.name,
                    logo_url: form.logo_url || undefined,
                });
                toast('อัปเดตบริษัทเรียบร้อย', 'success');
            } else {
                await createCompany({
                    code: form.code,
                    name: form.name,
                    logo_url: form.logo_url || undefined,
                });
                toast('สร้างบริษัทเรียบร้อย', 'success');
            }
            setShowModal(false);
            refetch();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (c: Company) => {
        const action = c.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน';
        if (!(await showConfirm({ message: `ต้องการ${action}บริษัท "${c.name}"?`, type: c.is_active ? 'danger' : 'info', confirmText: action }))) return;
        try {
            await toggleCompanyActive(c.id);
            toast(`${action}เรียบร้อย`, 'success');
            refetch();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        }
    };

    const handleSwitchCompany = (c: Company) => {
        setActiveCompany({ id: c.id, code: c.code, name: c.name, logo_url: c.logo_url });
        toast(`เปลี่ยนเป็นบริษัท ${c.name}`, 'success');
    };

    return (
        <div className="pt-6 md:pt-8 pb-24 md:pb-8 px-4 md:px-8 max-w-5xl mx-auto min-h-full font-display">
            {/* Header */}
            <header className="mb-8">
                <button onClick={() => navigate('/profile')} className="md:hidden text-slate-500 hover:text-primary transition-colors mb-4 flex items-center gap-1 text-sm">
                    <span className="material-icons-round text-lg">arrow_back</span>
                    <span>กลับหน้าโปรไฟล์</span>
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการบริษัท</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            กำลังดูข้อมูลบริษัท: <span className="font-semibold text-primary">{activeCompany?.name || '-'}</span>
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="bg-primary hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.97]"
                    >
                        <span className="material-icons-round text-lg">add_business</span>
                        สร้างบริษัท
                    </button>
                </div>
            </header>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-16">
                    <span className="material-icons-round text-4xl text-gray-300 animate-spin">autorenew</span>
                </div>
            )}

            {/* Company Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(companies || []).map((c: Company) => {
                    const isCurrentCompany = activeCompany?.id === c.id;
                    return (
                        <div
                            key={c.id}
                            className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border-2 relative overflow-hidden group hover:shadow-md transition-all ${isCurrentCompany
                                ? 'border-primary ring-2 ring-primary/20'
                                : c.is_active
                                    ? 'border-gray-100 dark:border-gray-700'
                                    : 'border-gray-200 dark:border-gray-700 opacity-60'
                                }`}
                        >
                            {/* Active company indicator */}
                            {isCurrentCompany && (
                                <div className="absolute top-3 right-3">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        ACTIVE
                                    </span>
                                </div>
                            )}

                            {/* Company Icon + Name */}
                            <div className="flex items-start gap-3 mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.is_active ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                    {c.logo_url ? (
                                        <img src={c.logo_url} alt={c.name} className="w-8 h-8 rounded-lg object-contain" />
                                    ) : (
                                        <span className={`material-icons-round text-2xl ${c.is_active ? 'text-amber-600' : 'text-gray-400'}`}>domain</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{c.name}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{c.code}</p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="material-icons-round text-sm">people</span>
                                    <span className="font-semibold">{c.employee_count}</span> พนักงาน
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.is_active
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {c.is_active ? 'ใช้งาน' : 'ปิดการใช้งาน'}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                {!isCurrentCompany && c.is_active && (
                                    <button
                                        onClick={() => handleSwitchCompany(c)}
                                        className="flex-1 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <span className="material-icons-round text-sm">swap_horiz</span>
                                        เปลี่ยนเป็นบริษัทนี้
                                    </button>
                                )}
                                <button
                                    onClick={() => openEdit(c)}
                                    className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-primary transition-colors"
                                    title="แก้ไข"
                                >
                                    <span className="material-icons-round text-base">edit</span>
                                </button>
                                {c.id !== 1 && (
                                    <button
                                        onClick={() => handleToggleActive(c)}
                                        className={`p-2 rounded-lg transition-colors ${c.is_active
                                            ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500'
                                            : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-500'
                                            }`}
                                        title={c.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                                    >
                                        <span className="material-icons-round text-base">{c.is_active ? 'block' : 'check_circle'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Empty state */}
                {!loading && (!companies || companies.length === 0) && (
                    <div className="col-span-full py-16 text-center">
                        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">domain_disabled</span>
                        <p className="text-gray-400 dark:text-gray-500">ยังไม่มีบริษัท</p>
                        <button onClick={openCreate} className="mt-3 text-primary font-semibold text-sm hover:text-blue-700">+ สร้างบริษัทแรก</button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center pt-[15vh]" onClick={() => setShowModal(false)}>
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        style={{ animation: 'companyModalIn 0.3s ease-out' }}
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingCompany ? 'แก้ไขบริษัท' : 'สร้างบริษัทใหม่'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        {/* Form */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                                    รหัสบริษัท <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    placeholder="เช่น PRM, ABC, XYZ"
                                    maxLength={20}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                                    ชื่อบริษัท <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="เช่น บริษัท พรีมาพาสชั่น จำกัด"
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                                    Logo URL <span className="text-gray-400">(ไม่บังคับ)</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.logo_url}
                                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                                    placeholder="https://example.com/logo.png"
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.code || !form.name}
                                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <span className="material-icons-round animate-spin text-lg">autorenew</span>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-lg">save</span>
                                        {editingCompany ? 'อัปเดต' : 'สร้างบริษัท'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Animation */}
            <style>{`
                @keyframes companyModalIn {
                    from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default AdminCompanyScreen;
