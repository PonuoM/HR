import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getWorkDays, createWorkDay, deleteWorkDay,
    getEmployees,
    WorkDay, WorkDayDepartment,
} from '../../services/api';
import { useToast } from '../../components/Toast';
import DatePickerModal from '../../components/DatePickerModal';
import CustomSelect from '../../components/CustomSelect';

const DOW_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

type Scope = 'company' | 'department' | 'employee';

interface EmployeeLite {
    id: string;
    name: string;
    nickname?: string;
}

const SCOPE_LABEL: Record<Scope, string> = {
    company: 'ทั้งบริษัท',
    department: 'เฉพาะแผนก',
    employee: 'เฉพาะพนักงาน',
};

const AdminWorkDayScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast, confirm } = useToast();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [workDays, setWorkDays] = useState<WorkDay[]>([]);
    const [departments, setDepartments] = useState<WorkDayDepartment[]>([]);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    // Employee list for the picker
    const [employees, setEmployees] = useState<EmployeeLite[]>([]);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formDate, setFormDate] = useState('');
    const [formScope, setFormScope] = useState<Scope>('company');
    const [formDeptId, setFormDeptId] = useState('');
    const [formEmpId, setFormEmpId] = useState('');
    const [formNote, setFormNote] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(() => {
        setLoading(true);
        getWorkDays(selectedYear)
            .then(d => {
                setWorkDays(d.work_days || []);
                setDepartments(d.departments || []);
                setAvailableYears(d.available_years || []);
                setLoading(false);
            })
            .catch(() => { setWorkDays([]); setLoading(false); });
    }, [selectedYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Load employees once (for the employee picker)
    useEffect(() => {
        getEmployees().then((list: any[]) => setEmployees(list || [])).catch(() => { });
    }, []);

    // Year options
    const yearOptions: number[] = [];
    const curYear = new Date().getFullYear();
    for (let y = curYear + 2; y >= curYear - 3; y--) yearOptions.push(y);
    availableYears.forEach(y => { if (!yearOptions.includes(y)) yearOptions.push(y); });
    yearOptions.sort((a, b) => b - a);

    // Open add form
    const openAdd = () => {
        setFormDate(`${selectedYear}-01-01`);
        setFormScope('company');
        setFormDeptId('');
        setFormEmpId('');
        setFormNote('');
        setShowForm(true);
    };

    // Save (create only)
    const handleSave = async () => {
        if (!formDate) return;
        if (formScope === 'department' && !formDeptId) { toast('กรุณาเลือกแผนก', 'warning'); return; }
        if (formScope === 'employee' && !formEmpId) { toast('กรุณาเลือกพนักงาน', 'warning'); return; }
        setSaving(true);
        try {
            await createWorkDay({
                date: formDate,
                scope: formScope,
                ...(formScope === 'department' ? { department_id: Number(formDeptId) } : {}),
                ...(formScope === 'employee' ? { employee_id: formEmpId } : {}),
                ...(formNote.trim() ? { note: formNote.trim() } : {}),
            });
            setShowForm(false);
            toast('เพิ่มวันทำงานพิเศษสำเร็จ', 'success');
            // Switch to the year of the saved record
            const savedYear = parseInt(formDate.split('-')[0]);
            if (savedYear === selectedYear) fetchData();
            else setSelectedYear(savedYear);
        } catch (e: any) {
            toast(e?.message || 'เกิดข้อผิดพลาด', 'error');
        }
        setSaving(false);
    };

    // Delete
    const handleDelete = async (w: WorkDay) => {
        const ok = await confirm({
            title: 'ยืนยันลบวันทำงานพิเศษ?',
            message: `${fmtDate(w.date)} (${SCOPE_LABEL[w.scope]})`,
            confirmText: 'ลบ',
            type: 'danger',
        });
        if (!ok) return;
        try {
            await deleteWorkDay(w.id);
            toast('ลบวันทำงานพิเศษแล้ว', 'success');
            fetchData();
        } catch (e: any) {
            toast(e?.message || 'เกิดข้อผิดพลาด', 'error');
        }
    };

    // Format date (Thai)
    const fmtDate = (d: string) => {
        const dt = new Date(d);
        return `${dt.getDate()} ${dt.toLocaleDateString('th-TH', { month: 'short' })} ${dt.getFullYear() + 543}`;
    };

    // Target label for a work day
    const targetLabel = (w: WorkDay) => {
        if (w.scope === 'company') return '— ทั้งบริษัท';
        if (w.scope === 'department') return `แผนก: ${w.department_name || w.department_id || '-'}`;
        return `พนักงาน: ${w.employee_name || w.employee_id || '-'}`;
    };

    // Sorted by date ascending
    const sorted = [...workDays].sort((a, b) => a.date.localeCompare(b.date));

    const deptOptions = departments.map(d => ({ value: String(d.id), label: d.name }));
    const empOptions = employees.map(e => ({
        value: e.id,
        label: e.nickname ? `${e.name} (${e.nickname})` : e.name,
        badge: e.id,
    }));

    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-4xl mx-auto min-h-full">
            {/* Header */}
            <header className="mb-6 flex items-center gap-3">
                <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">วันทำงานพิเศษ</h1>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">กำหนดวันที่ปกติหยุดให้เป็นวันทำงาน (เช่น วันเสาร์)</p>
                </div>
            </header>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6 mb-6">
                <div className="flex flex-wrap gap-3 items-end">
                    {/* Year selector */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ปี (พ.ศ.)</label>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none min-w-[120px]"
                        >
                            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                        </select>
                    </div>

                    {/* Total badge */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="material-icons-round text-green-500 text-lg">event_available</span>
                        <span className="text-sm font-semibold text-green-700 dark:text-green-300">{sorted.length} วันทำงานพิเศษ</span>
                    </div>

                    {/* Actions */}
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-colors"
                        >
                            <span className="material-icons-round text-base">add</span>
                            เพิ่มวันทำงานพิเศษ
                        </button>
                    </div>
                </div>
            </div>

            {/* Work Day List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">event_busy</span>
                        <p className="text-gray-500 font-medium mb-2">ยังไม่มีวันทำงานพิเศษสำหรับปี {selectedYear + 543}</p>
                        <p className="text-xs text-gray-400 mb-4">เพิ่มวันทำงานพิเศษใหม่</p>
                        <button onClick={openAdd} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold">
                            <span className="material-icons-round text-base align-middle mr-1">add</span>
                            เพิ่มวันทำงานพิเศษ
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] text-gray-500 uppercase tracking-wider">
                                        <th className="p-3 text-left font-semibold w-12">#</th>
                                        <th className="p-3 text-left font-semibold">วันที่</th>
                                        <th className="p-3 text-left font-semibold">วัน</th>
                                        <th className="p-3 text-left font-semibold">ขอบเขต</th>
                                        <th className="p-3 text-left font-semibold">หมายเหตุ</th>
                                        <th className="p-3 text-center font-semibold w-20">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {sorted.map((w, i) => {
                                        const dt = new Date(w.date);
                                        const dow = dt.getDay();
                                        const isWeekend = dow === 0 || dow === 6;
                                        return (
                                            <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <td className="p-3 text-sm text-gray-400">{i + 1}</td>
                                                <td className="p-3">
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtDate(w.date)}</span>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-sm ${isWeekend ? 'text-green-600 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}>
                                                        {DOW_TH[dow]}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold text-primary">{SCOPE_LABEL[w.scope]}</span>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{targetLabel(w)}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">{w.note || '-'}</span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleDelete(w)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                                                        title="ลบ"
                                                    >
                                                        <span className="material-icons-round text-base">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                            {sorted.map((w) => {
                                const dt = new Date(w.date);
                                const dow = dt.getDay();
                                const isWeekend = dow === 0 || dow === 6;
                                return (
                                    <div key={w.id} className="p-4 flex items-center gap-3">
                                        {/* Date badge */}
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 flex flex-col items-center justify-center shrink-0">
                                            <span className="text-lg font-bold text-green-600 leading-tight">{dt.getDate()}</span>
                                            <span className="text-[10px] text-green-600/70">{dt.toLocaleDateString('th-TH', { month: 'short' })}</span>
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{targetLabel(w)}</p>
                                            <p className={`text-xs ${isWeekend ? 'text-green-600' : 'text-gray-500'}`}>
                                                วัน{DOW_TH[dow]} • {fmtDate(w.date)}
                                            </p>
                                            <p className="text-[11px] text-primary font-medium">{SCOPE_LABEL[w.scope]}{w.note ? ` • ${w.note}` : ''}</p>
                                        </div>
                                        {/* Actions */}
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => handleDelete(w)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                <span className="material-icons-round text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* ═══ ADD MODAL ═══ */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowForm(false)}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">➕ เพิ่มวันทำงานพิเศษ</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันที่</label>
                                <button
                                    type="button"
                                    onClick={() => setShowDatePicker(true)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white hover:border-primary/50 transition-colors"
                                >
                                    <span>{formDate ? fmtDate(formDate) : 'เลือกวันที่'}</span>
                                    <span className="material-icons-round text-lg text-gray-400">calendar_today</span>
                                </button>
                            </div>

                            {/* Scope */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ขอบเขต</label>
                                <CustomSelect
                                    options={[
                                        { value: 'company', label: 'ทั้งบริษัท' },
                                        { value: 'department', label: 'เฉพาะแผนก' },
                                        { value: 'employee', label: 'เฉพาะพนักงาน' },
                                    ]}
                                    value={formScope}
                                    onChange={v => {
                                        const next = (v || 'company') as Scope;
                                        setFormScope(next);
                                        if (next !== 'department') setFormDeptId('');
                                        if (next !== 'employee') setFormEmpId('');
                                    }}
                                    placeholder="เลือกขอบเขต"
                                />
                            </div>

                            {/* Conditional: Department */}
                            {formScope === 'department' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">แผนก</label>
                                    <CustomSelect
                                        options={deptOptions}
                                        value={formDeptId}
                                        onChange={setFormDeptId}
                                        placeholder="เลือกแผนก"
                                    />
                                </div>
                            )}

                            {/* Conditional: Employee */}
                            {formScope === 'employee' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">พนักงาน</label>
                                    <CustomSelect
                                        options={empOptions}
                                        value={formEmpId}
                                        onChange={setFormEmpId}
                                        placeholder="เลือกพนักงาน"
                                    />
                                </div>
                            )}

                            {/* Note */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมายเหตุ (ไม่บังคับ)</label>
                                <input
                                    type="text"
                                    value={formNote}
                                    onChange={e => setFormNote(e.target.value)}
                                    placeholder="เช่น ชดเชยวันหยุด, ทำงานเสาร์"
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formDate}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก...' : 'เพิ่ม'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Picker */}
            {showDatePicker && (
                <DatePickerModal
                    value={formDate}
                    title="เลือกวันทำงานพิเศษ"
                    onSelect={(d) => { setFormDate(d); setShowDatePicker(false); }}
                    onClose={() => setShowDatePicker(false)}
                />
            )}
        </div>
    );
};

export default AdminWorkDayScreen;
