import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getDepartments, updateDepartment } from '../../services/api';
import { useToast } from '../../components/Toast';

interface Department {
    id: number;
    name: string;
    work_start_time: string;
    work_end_time: string;
    work_hours_per_day: string;
}

const AdminDepartmentScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { data: departments, refetch } = useApi(() => getDepartments(), []);

    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({ name: '', work_start_time: '09:00', work_end_time: '17:00' });
    const [saving, setSaving] = useState(false);

    const openEdit = (dept: Department) => {
        setEditId(dept.id);
        setForm({
            name: dept.name,
            work_start_time: dept.work_start_time?.substring(0, 5) || '09:00',
            work_end_time: dept.work_end_time?.substring(0, 5) || '17:00',
        });
    };

    const cancelEdit = () => {
        setEditId(null);
    };

    const handleSave = async () => {
        if (!editId || !form.name.trim()) return;
        setSaving(true);
        try {
            await updateDepartment(editId, {
                name: form.name.trim(),
                work_start_time: form.work_start_time + ':00',
                work_end_time: form.work_end_time + ':00',
            });
            toast('บันทึกเรียบร้อย', 'success');
            setEditId(null);
            refetch();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Calculate hours from time strings
    const calcHours = (start: string, end: string) => {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        return diff > 0 ? (diff / 60).toFixed(1) : '0';
    };

    const inputCls = "w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50";

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            {/* Header */}
            <header className="bg-white dark:bg-[#15202b] pt-4 pb-4 px-4 md:px-6 shadow-sm z-20 flex justify-between items-center sticky top-0 md:bg-white/90 md:backdrop-blur-md">
                <button onClick={() => navigate(-1)} className="text-slate-500 dark:text-slate-400 md:hidden active:opacity-70 flex items-center gap-1">
                    <span className="material-icons-round text-lg">arrow_back</span>
                    <span className="text-sm font-medium">กลับ</span>
                </button>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-icons-round text-primary">apartment</span>
                    จัดการแผนก
                </h1>
                <div className="w-16"></div>
            </header>

            <main className="flex-1 overflow-y-auto scrollbar-hide px-4 md:px-6 py-6">
                <div className="max-w-3xl mx-auto space-y-4">

                    {/* Info Banner */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                        <span className="material-icons-round text-blue-600 text-lg mt-0.5">info</span>
                        <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            <p className="font-semibold mb-1">เวลาทำงานของแผนก</p>
                            <p>กำหนดเวลาเข้า-ออกงานของแต่ละแผนก ระบบจะนำไปใช้คำนวณวันลา (ลาครึ่งวัน, ลาเป็นชั่วโมง) และ auto set เวลาในฟอร์มใบลาให้ตามแผนกโดยอัตโนมัติ</p>
                        </div>
                    </div>

                    {/* Department List */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
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
                                        {editId === dept.id ? (
                                            /* --- EDIT MODE --- */
                                            <div className="space-y-3 animate-in fade-in">
                                                <div>
                                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">ชื่อแผนก</label>
                                                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">เวลาเข้างาน</label>
                                                        <input type="time" value={form.work_start_time} onChange={(e) => setForm({ ...form, work_start_time: e.target.value })} className={inputCls} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">เวลาออกงาน</label>
                                                        <input type="time" value={form.work_end_time} onChange={(e) => setForm({ ...form, work_end_time: e.target.value })} className={inputCls} />
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
                                                    <span className="material-icons-round text-sm">calculate</span>
                                                    รวม {calcHours(form.work_start_time, form.work_end_time)} ชั่วโมง/วัน
                                                </div>
                                                <div className="flex gap-2 pt-1">
                                                    <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all">
                                                        {saving ? <span className="material-icons-round animate-spin text-sm">autorenew</span> : <span className="material-icons-round text-sm">save</span>}
                                                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                                    </button>
                                                    <button onClick={cancelEdit} className="px-4 py-2.5 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                        ยกเลิก
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* --- VIEW MODE --- */
                                            <div className="flex items-center justify-between group">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                                                        <span className="material-icons-round text-blue-600 dark:text-blue-400 text-lg">apartment</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{dept.name}</p>
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
                                                <button
                                                    onClick={() => openEdit(dept)}
                                                    className="ml-3 p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all opacity-60 group-hover:opacity-100"
                                                    title="แก้ไข"
                                                >
                                                    <span className="material-icons-round text-lg">edit</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDepartmentScreen;
