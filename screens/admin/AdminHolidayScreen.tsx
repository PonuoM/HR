import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../services/api';

interface Holiday {
    id: number;
    date: string;
    name: string;
    year: number;
    created_at: string;
}

interface HolidayData {
    holidays: Holiday[];
    year: number;
    available_years: number[];
    total: number;
}

const DOW_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const AdminHolidayScreen: React.FC = () => {
    const navigate = useNavigate();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<HolidayData | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formDate, setFormDate] = useState('');
    const [formName, setFormName] = useState('');
    const [saving, setSaving] = useState(false);

    // Copy state
    const [showCopy, setShowCopy] = useState(false);
    const [copyFromYear, setCopyFromYear] = useState(new Date().getFullYear());
    const [copyToYear, setCopyToYear] = useState(new Date().getFullYear() + 1);
    const [copying, setCopying] = useState(false);

    // Delete confirm
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`${API_BASE}/holidays.php?year=${selectedYear}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [selectedYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Year options
    const yearOptions: number[] = [];
    const curYear = new Date().getFullYear();
    for (let y = curYear + 2; y >= curYear - 3; y--) yearOptions.push(y);
    // Merge with available_years
    if (data?.available_years) {
        data.available_years.forEach(y => { if (!yearOptions.includes(y)) yearOptions.push(y); });
        yearOptions.sort((a, b) => b - a);
    }

    // Open add form
    const openAdd = () => {
        setEditId(null);
        setFormDate(`${selectedYear}-01-01`);
        setFormName('');
        setShowForm(true);
    };

    // Open edit form
    const openEdit = (h: Holiday) => {
        setEditId(h.id);
        setFormDate(h.date);
        setFormName(h.name);
        setShowForm(true);
    };

    // Save (create or update)
    const handleSave = async () => {
        if (!formDate || !formName.trim()) return;
        setSaving(true);
        try {
            const url = editId
                ? `${API_BASE}/holidays.php?id=${editId}`
                : `${API_BASE}/holidays.php`;
            const method = editId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: formDate, name: formName.trim() }),
            });
            const json = await res.json();
            if (!res.ok) {
                alert(json.error || 'Error');
            } else {
                setShowForm(false);
                // Switch to the year of the saved holiday
                const savedYear = parseInt(formDate.split('-')[0]);
                setSelectedYear(savedYear);
                fetchData();
            }
        } catch { alert('Network error'); }
        setSaving(false);
    };

    // Delete
    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await fetch(`${API_BASE}/holidays.php?id=${deleteId}`, { method: 'DELETE' });
            setDeleteId(null);
            fetchData();
        } catch { alert('Network error'); }
        setDeleting(false);
    };

    // Copy
    const handleCopy = async () => {
        if (copyFromYear === copyToYear) { alert('ปีต้นทางและปลายทางต้องต่างกัน'); return; }
        setCopying(true);
        try {
            const res = await fetch(`${API_BASE}/holidays.php?action=copy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from_year: copyFromYear, to_year: copyToYear }),
            });
            const json = await res.json();
            if (res.ok) {
                alert(`คัดลอกวันหยุดสำเร็จ ${json.copied} วัน`);
                setShowCopy(false);
                setSelectedYear(copyToYear);
                fetchData();
            } else {
                alert(json.error || 'Error');
            }
        } catch { alert('Network error'); }
        setCopying(false);
    };

    const holidays = data?.holidays || [];

    // Format date
    const fmtDate = (d: string) => {
        const dt = new Date(d);
        return `${dt.getDate()} ${dt.toLocaleDateString('th-TH', { month: 'short' })} ${dt.getFullYear() + 543}`;
    };

    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-4xl mx-auto min-h-full">
            {/* Header */}
            <header className="mb-6 flex items-center gap-3">
                <button onClick={() => navigate('/admin')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">วันหยุดบริษัท</h1>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">จัดการวันหยุดประจำปีของบริษัท</p>
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
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <span className="material-icons-round text-blue-500 text-lg">celebration</span>
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{holidays.length} วันหยุด</span>
                    </div>

                    {/* Actions */}
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={() => setShowCopy(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <span className="material-icons-round text-base">content_copy</span>
                            คัดลอกปี
                        </button>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-colors"
                        >
                            <span className="material-icons-round text-base">add</span>
                            เพิ่มวันหยุด
                        </button>
                    </div>
                </div>
            </div>

            {/* Holiday List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                ) : holidays.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">event_busy</span>
                        <p className="text-gray-500 font-medium mb-2">ยังไม่มีวันหยุดสำหรับปี {selectedYear + 543}</p>
                        <p className="text-xs text-gray-400 mb-4">เพิ่มวันหยุดใหม่ หรือคัดลอกจากปีอื่น</p>
                        <button onClick={openAdd} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold">
                            <span className="material-icons-round text-base align-middle mr-1">add</span>
                            เพิ่มวันหยุด
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
                                        <th className="p-3 text-left font-semibold">ชื่อวันหยุด</th>
                                        <th className="p-3 text-center font-semibold w-28">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {holidays.map((h, i) => {
                                        const dt = new Date(h.date);
                                        const dow = dt.getDay();
                                        const isWeekend = dow === 0 || dow === 6;
                                        return (
                                            <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <td className="p-3 text-sm text-gray-400">{i + 1}</td>
                                                <td className="p-3">
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtDate(h.date)}</span>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-sm ${isWeekend ? 'text-red-500 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}>
                                                        {DOW_TH[dow]}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">🎌</span>
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white">{h.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => openEdit(h)}
                                                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors"
                                                            title="แก้ไข"
                                                        >
                                                            <span className="material-icons-round text-base">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteId(h.id)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                                                            title="ลบ"
                                                        >
                                                            <span className="material-icons-round text-base">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                            {holidays.map((h, i) => {
                                const dt = new Date(h.date);
                                const dow = dt.getDay();
                                const isWeekend = dow === 0 || dow === 6;
                                return (
                                    <div key={h.id} className="p-4 flex items-center gap-3">
                                        {/* Date badge */}
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center shrink-0">
                                            <span className="text-lg font-bold text-primary leading-tight">{dt.getDate()}</span>
                                            <span className="text-[10px] text-primary/70">{dt.toLocaleDateString('th-TH', { month: 'short' })}</span>
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{h.name}</p>
                                            <p className={`text-xs ${isWeekend ? 'text-red-500' : 'text-gray-500'}`}>
                                                วัน{DOW_TH[dow]} • {fmtDate(h.date)}
                                            </p>
                                        </div>
                                        {/* Actions */}
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => openEdit(h)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                                <span className="material-icons-round text-lg">edit</span>
                                            </button>
                                            <button onClick={() => setDeleteId(h.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
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

            {/* ═══ ADD/EDIT MODAL ═══ */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-start pt-[10vh] justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowForm(false)}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editId ? '✏️ แก้ไขวันหยุด' : '➕ เพิ่มวันหยุด'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันที่</label>
                                <input
                                    type="date"
                                    value={formDate}
                                    onChange={e => setFormDate(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อวันหยุด</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="เช่น วันสงกรานต์, วันขึ้นปีใหม่"
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
                                    disabled={saving || !formDate || !formName.trim()}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก...' : (editId ? 'บันทึก' : 'เพิ่ม')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ COPY MODAL ═══ */}
            {showCopy && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowCopy(false)}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">📋 คัดลอกวันหยุดข้ามปี</h2>
                            <button onClick={() => setShowCopy(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-500">คัดลอกวันหยุดทั้งหมดจากปีหนึ่งไปอีกปี (วันที่ซ้ำจะข้ามอัตโนมัติ)</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">จากปี</label>
                                    <select
                                        value={copyFromYear}
                                        onChange={e => setCopyFromYear(Number(e.target.value))}
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                    >
                                        {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ไปปี</label>
                                    <select
                                        value={copyToYear}
                                        onChange={e => setCopyToYear(Number(e.target.value))}
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                    >
                                        {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowCopy(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleCopy}
                                    disabled={copying || copyFromYear === copyToYear}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-colors disabled:opacity-50"
                                >
                                    {copying ? 'กำลังคัดลอก...' : 'คัดลอก'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ DELETE CONFIRM ═══ */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDeleteId(null)}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="p-6 text-center">
                            <span className="material-icons-round text-red-500 text-5xl mb-3 block">warning</span>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">ยืนยันลบวันหยุด?</h3>
                            <p className="text-sm text-gray-500 mb-1">
                                {holidays.find(h => h.id === deleteId)?.name}
                            </p>
                            <p className="text-xs text-gray-400 mb-6">
                                {holidays.find(h => h.id === deleteId)?.date && fmtDate(holidays.find(h => h.id === deleteId)!.date)}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDeleteId(null)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {deleting ? 'กำลังลบ...' : 'ลบ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHolidayScreen;
