import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getQuotaOverview, getDepartments } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AdminQuotaOverviewScreen: React.FC = () => {
    const navigate = useNavigate();
    const { isSuperAdmin } = useAuth();

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('');

    const { data: overview, loading, refetch } = useApi(() => getQuotaOverview(year), [year]);
    const { data: depts } = useApi(() => getDepartments(), []);

    const employees = overview?.employees || [];
    const leaveTypes = overview?.leave_types || [];

    // Filter employees by search + department
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return employees.filter((emp) => {
            if (q && !emp.name.toLowerCase().includes(q) && !emp.employee_id.toLowerCase().includes(q) && !(emp.nickname || '').toLowerCase().includes(q)) {
                return false;
            }
            if (deptFilter && emp.department !== deptFilter) return false;
            return true;
        });
    }, [employees, search, deptFilter]);

    const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    // Trim trailing zeros: 5.00 → "5", 5.50 → "5.5", 5.12 → "5.12"
    const fmtNum = (n: number | null | undefined): string => {
        if (n === null || n === undefined) return '-';
        const r = Math.round(n * 100) / 100;
        return Number.isInteger(r) ? r.toString() : parseFloat(r.toFixed(2)).toString();
    };

    const formatRemaining = (q: any) => {
        if (q.total === null) return '-';
        if (q.remaining === -1) return '∞';
        if (q.remaining < 0) return `เกิน ${fmtNum(Math.abs(q.remaining))}`;
        return `${fmtNum(q.remaining)}/${fmtNum(q.total)}`;
    };

    const remainingClass = (q: any) => {
        if (q.total === null) return 'text-gray-300';
        if (q.remaining === -1) return 'text-blue-500 font-semibold';
        if (q.remaining < 0) return 'text-red-700 font-bold'; // exceeded quota
        if (q.total === 0) return 'text-gray-400';
        if (q.remaining <= 1) return 'text-red-600 font-bold';
        if (q.remaining <= 3) return 'text-amber-600 font-semibold';
        return 'text-green-700 dark:text-green-400 font-semibold';
    };

    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto min-h-full">
            {/* Header */}
            <header className="mb-6 flex items-start gap-3 flex-wrap">
                <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">ภาพรวมโควต้าการลา</h1>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">โควต้าและการใช้งานของพนักงานทุกคน • คลิกที่ชื่อเพื่อดูรายละเอียด</p>
                </div>
                <button onClick={() => refetch()} className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                    <span className="material-icons-round text-base">refresh</span>
                    รีเฟรช
                </button>
            </header>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-4 flex flex-wrap items-center gap-3">
                {/* Year */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-semibold">ปี:</span>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none">
                        {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                    </select>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <span className="material-icons-round absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-base">search</span>
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="ค้นหาชื่อ / รหัส / ชื่อเล่น..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                </div>

                {/* Department */}
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none">
                    <option value="">ทุกแผนก</option>
                    {(depts || []).map((d: any) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                </select>

                <span className="text-xs text-gray-400 ml-auto">แสดง {filtered.length} / {employees.length} คน</span>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="text-center py-16">
                        <span className="material-icons-round text-4xl text-gray-300 animate-spin">autorenew</span>
                        <p className="text-sm text-gray-500 mt-2">กำลังโหลดข้อมูล...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-icons-round text-5xl text-gray-300 mb-3 block">person_off</span>
                        <p className="text-gray-500 font-medium">ไม่พบพนักงาน</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">
                                    <th className="px-3 py-3 font-semibold sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">พนักงาน</th>
                                    <th className="px-3 py-3 font-semibold">แผนก</th>
                                    {leaveTypes.map((lt) => (
                                        <th key={lt.id} className="px-3 py-3 font-semibold text-center" title={lt.name}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={`material-icons-round text-base text-${lt.color}-500`}>{lt.icon}</span>
                                                <span className="text-[10px] normal-case font-bold text-gray-600 dark:text-gray-300">{lt.name}</span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-3 font-semibold text-center">รายละเอียด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.map((emp) => (
                                    <tr key={emp.employee_id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-sm">
                                        <td className="px-3 py-2.5 sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900 dark:text-white text-sm">{emp.name}</div>
                                            <div className="text-[10px] text-gray-400">{emp.employee_id}{emp.nickname ? ` • ${emp.nickname}` : ''}</div>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{emp.department}</td>
                                        {emp.quotas.map((q) => (
                                            <td key={q.leave_type_id} className="px-3 py-2.5 text-center">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className={`text-sm ${remainingClass(q)}`}>{formatRemaining(q)}</span>
                                                    {q.used > 0 && (
                                                        <span className="text-[9px] text-gray-400">ใช้ {fmtNum(q.used)}</span>
                                                    )}
                                                </div>
                                            </td>
                                        ))}
                                        <td className="px-2 py-2.5 text-center">
                                            <button
                                                onClick={() => navigate('/admin/employees', { state: { editEmployeeId: emp.employee_id } })}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 text-[10px] font-semibold transition-colors"
                                                title="ดูรายละเอียด + ประวัติการลา"
                                            >
                                                <span className="material-icons-round text-[14px]">visibility</span>
                                                ดู
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-4 bg-blue-50/40 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/40 rounded-xl px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400">
                <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">📖 อ่านค่ายังไง</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><b className="text-green-700">5/7</b> = เหลือ 5 จาก 7 วัน</span>
                    <span><b className="text-amber-600">2/7</b> = เหลือน้อย (≤3)</span>
                    <span><b className="text-red-600">0/7</b> = หมดแล้ว</span>
                    <span><b className="text-blue-500">∞</b> = ไม่จำกัด (ลาไม่รับค่าจ้าง)</span>
                    <span><b className="text-gray-400">-</b> = ไม่มี quota</span>
                </div>
                {!isSuperAdmin && (
                    <div className="mt-2 text-[10px] text-gray-400">ดูเฉพาะบริษัทปัจจุบัน — superadmin เท่านั้นที่เห็นทุกบริษัท</div>
                )}
            </div>
        </div>
    );
};

export default AdminQuotaOverviewScreen;
