import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../services/api';
import { useApi } from '../../hooks/useApi';

interface ReportRow {
    employee_id: string;
    employee_name: string;
    department: string;
    base_salary: number;
    work_start_time: string;
    expected_work_days: number;
    actual_work_days: number;
    absent_days: number;
    late_count: number;
    late_minutes_total: number;
    leave_by_type: { leave_type_id: number; leave_type_name: string; days: number }[];
    total_leave_days: number;
    ot_hours: number;
    total_work_hours: number;
    diligence_eligible: boolean;
}

interface ReportData {
    period: string;
    expected_work_days: number;
    leave_types: { id: number; name: string; type: string }[];
    employees: ReportRow[];
    summary: {
        total_employees: number;
        total_absent_days: number;
        total_late_count: number;
        total_late_minutes: number;
        total_leave_days: number;
        total_ot_hours: number;
        diligence_eligible_count: number;
    };
}

const AdminAttendanceReportScreen: React.FC = () => {
    const navigate = useNavigate();
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    // Build API URL
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (viewMode === 'monthly') {
            params.set('month', selectedMonth);
        } else {
            params.set('year', String(selectedYear));
        }
        if (selectedEmployee) params.set('employee_id', selectedEmployee);
        return `${API_BASE}/attendance_report.php?${params.toString()}`;
    }, [viewMode, selectedMonth, selectedYear, selectedEmployee]);

    const { data, loading } = useApi<ReportData>(() => fetch(apiUrl).then(r => r.json()), [apiUrl]);

    const report = data?.employees || [];
    const summary = data?.summary;
    const leaveTypes = data?.leave_types || [];

    // Employee list for filter dropdown
    const { data: empListData } = useApi(() =>
        fetch(`${API_BASE}/attendance_report.php?month=${selectedMonth}`).then(r => r.json()),
        [selectedMonth]
    );
    const allEmployees = (empListData?.employees || []) as ReportRow[];

    // CSV export URL
    const csvUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (viewMode === 'monthly') {
            params.set('month', selectedMonth);
        } else {
            params.set('year', String(selectedYear));
        }
        if (selectedEmployee) params.set('employee_id', selectedEmployee);
        params.set('export', 'csv');
        return `${API_BASE}/attendance_report.php?${params.toString()}`;
    }, [viewMode, selectedMonth, selectedYear, selectedEmployee]);

    // Get leave days for a specific type
    const getLeave = (row: ReportRow, typeId: number) => {
        const found = row.leave_by_type.find(l => l.leave_type_id === typeId);
        return found ? found.days : 0;
    };

    // Years for dropdown
    const yearOptions = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 3; y--) yearOptions.push(y);

    // Month label in Thai
    const monthLabel = (m: string) => {
        const d = new Date(m + '-01');
        return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1800px] mx-auto min-h-full">
            {/* Header */}
            <header className="mb-6 flex items-center gap-3">
                <button onClick={() => navigate('/admin')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">รายงานเข้างาน</h1>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">สรุปการมาทำงาน สาย ลา OT เบี้ยขยัน</p>
                </div>
            </header>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6 mb-6">
                <div className="flex flex-wrap gap-3 items-end">
                    {/* View Mode Toggle */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${viewMode === 'monthly' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}
                        >
                            รายเดือน
                        </button>
                        <button
                            onClick={() => setViewMode('yearly')}
                            className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${viewMode === 'yearly' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}
                        >
                            รายปี
                        </button>
                    </div>

                    {/* Month / Year selector */}
                    {viewMode === 'monthly' ? (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">เดือน</label>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">ปี</label>
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Employee filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">พนักงาน</label>
                        <select
                            value={selectedEmployee}
                            onChange={e => setSelectedEmployee(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none min-w-[180px]"
                        >
                            <option value="">ทุกคน</option>
                            {allEmployees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id}>{emp.employee_name} ({emp.department})</option>
                            ))}
                        </select>
                    </div>

                    {/* Export CSV */}
                    <a
                        href={csvUrl}
                        download
                        className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold shadow-sm transition-colors"
                    >
                        <span className="material-icons-round text-base">download</span>
                        Export CSV
                    </a>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && !loading && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                    {[
                        { label: 'พนักงาน', value: summary.total_employees, unit: 'คน', icon: 'people', color: 'blue' },
                        { label: 'ขาดงาน', value: summary.total_absent_days, unit: 'วัน', icon: 'event_busy', color: 'red' },
                        { label: 'สาย', value: summary.total_late_count, unit: 'ครั้ง', icon: 'alarm', color: 'orange' },
                        { label: 'สายรวม', value: summary.total_late_minutes, unit: 'นาที', icon: 'timer', color: 'amber' },
                        { label: 'ลารวม', value: summary.total_leave_days, unit: 'วัน', icon: 'beach_access', color: 'purple' },
                        { label: 'OT', value: summary.total_ot_hours, unit: 'ชม.', icon: 'more_time', color: 'cyan' },
                        { label: 'เบี้ยขยัน', value: summary.diligence_eligible_count, unit: 'คน', icon: 'emoji_events', color: 'green' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
                            <span className={`material-icons-round text-${s.color}-500 text-xl mb-1 block`}>{s.icon}</span>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                            <p className="text-[10px] text-gray-500">{s.label} <span className="text-gray-400">({s.unit})</span></p>
                        </div>
                    ))}
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white">
                        {viewMode === 'monthly' ? monthLabel(selectedMonth) : `ปี ${selectedYear + 543}`}
                        {selectedEmployee && ` — ${report[0]?.employee_name || ''}`}
                    </h3>
                    <span className="text-xs text-gray-400">
                        วันทำงานที่ควรมา: {data?.expected_work_days ?? '-'} วัน
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                ) : report.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">assignment</span>
                        <p className="text-gray-500 font-medium">ไม่มีข้อมูล</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">
                                    <th className="p-3 font-semibold sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">พนักงาน</th>
                                    <th className="p-3 font-semibold text-center">แผนก</th>
                                    <th className="p-3 font-semibold text-center">มาทำงาน</th>
                                    <th className="p-3 font-semibold text-center">ขาด</th>
                                    <th className="p-3 font-semibold text-center">สาย (ครั้ง)</th>
                                    <th className="p-3 font-semibold text-center">สาย (นาที)</th>
                                    {leaveTypes.map(lt => (
                                        <th key={lt.id} className="p-3 font-semibold text-center">{lt.name}</th>
                                    ))}
                                    <th className="p-3 font-semibold text-center">ลารวม</th>
                                    <th className="p-3 font-semibold text-center">OT (ชม.)</th>
                                    <th className="p-3 font-semibold text-center">ชม.ทำงาน</th>
                                    <th className="p-3 font-semibold text-center">เบี้ยขยัน</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {report.map(row => (
                                    <tr key={row.employee_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm">
                                        <td className="p-3 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white text-xs">{row.employee_name}</p>
                                                <p className="text-[10px] text-gray-400">{row.employee_id}</p>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-xs text-gray-600 dark:text-gray-300">{row.department}</td>
                                        <td className="p-3 text-center">
                                            <span className="font-semibold text-gray-900 dark:text-white">{row.actual_work_days}</span>
                                            <span className="text-[10px] text-gray-400">/{row.expected_work_days}</span>
                                        </td>
                                        <td className={`p-3 text-center font-semibold ${row.absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {row.absent_days}
                                        </td>
                                        <td className={`p-3 text-center font-semibold ${row.late_count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                            {row.late_count}
                                        </td>
                                        <td className={`p-3 text-center text-xs ${row.late_minutes_total > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                                            {row.late_minutes_total}
                                        </td>
                                        {leaveTypes.map(lt => {
                                            const days = getLeave(row, lt.id);
                                            return (
                                                <td key={lt.id} className={`p-3 text-center text-xs ${days > 0 ? 'text-purple-600 font-semibold' : 'text-gray-400'}`}>
                                                    {days || '-'}
                                                </td>
                                            );
                                        })}
                                        <td className={`p-3 text-center font-semibold ${row.total_leave_days > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                            {row.total_leave_days}
                                        </td>
                                        <td className={`p-3 text-center font-semibold ${row.ot_hours > 0 ? 'text-cyan-600' : 'text-gray-400'}`}>
                                            {row.ot_hours || '-'}
                                        </td>
                                        <td className="p-3 text-center text-xs text-gray-600 dark:text-gray-300">
                                            {row.total_work_hours}
                                        </td>
                                        <td className="p-3 text-center">
                                            {row.diligence_eligible ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px] font-bold">
                                                    <span className="material-icons-round text-xs">check_circle</span> ได้
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px] font-bold">
                                                    <span className="material-icons-round text-xs">cancel</span> ไม่ได้
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mobile Card View (for small screens) */}
            <div className="md:hidden mt-4 space-y-3">
                {!loading && report.map(row => (
                    <div key={row.employee_id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{row.employee_name}</h4>
                                <p className="text-[11px] text-gray-500">{row.department} • {row.employee_id}</p>
                            </div>
                            {row.diligence_eligible ? (
                                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center gap-1">
                                    <span className="material-icons-round text-xs">emoji_events</span> เบี้ยขยัน
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">ไม่ได้เบี้ยขยัน</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                                <p className="font-bold text-blue-700 dark:text-blue-300">{row.actual_work_days}/{row.expected_work_days}</p>
                                <p className="text-[10px] text-gray-500">มาทำงาน</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.absent_days > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>{row.absent_days}</p>
                                <p className="text-[10px] text-gray-500">ขาด</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.late_count > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.late_count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{row.late_count} <span className="font-normal text-[10px]">({row.late_minutes_total}น.)</span></p>
                                <p className="text-[10px] text-gray-500">สาย</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.total_leave_days > 0 ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.total_leave_days > 0 ? 'text-purple-600' : 'text-gray-400'}`}>{row.total_leave_days}</p>
                                <p className="text-[10px] text-gray-500">ลา (วัน)</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.ot_hours > 0 ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.ot_hours > 0 ? 'text-cyan-600' : 'text-gray-400'}`}>{row.ot_hours || '-'}</p>
                                <p className="text-[10px] text-gray-500">OT (ชม.)</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
                                <p className="font-bold text-gray-600 dark:text-gray-300">{row.total_work_hours}</p>
                                <p className="text-[10px] text-gray-500">ชม.รวม</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminAttendanceReportScreen;
