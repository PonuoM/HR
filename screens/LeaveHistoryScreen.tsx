import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { API_BASE, getLeaveRequests } from '../services/api';

function formatThaiDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'approved': return { label: 'อนุมัติ', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
        case 'rejected': return { label: 'ไม่อนุมัติ', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
        default: return { label: 'รออนุมัติ', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    }
}

const LeaveHistoryScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const empId = authUser?.id || '';

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Generate year options (current year ± 5)
    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
        return years;
    }, [currentYear]);

    const { data: allRequests = [], loading } = useApi(() => getLeaveRequests({ employee_id: empId }), [empId]);

    // Filter by selected year
    const requests = useMemo(() => {
        return (allRequests || []).filter((r: any) => {
            const year = new Date(r.created_at).getFullYear();
            return year === selectedYear;
        });
    }, [allRequests, selectedYear]);

    // Stats
    const stats = useMemo(() => {
        const total = requests.length;
        const approved = requests.filter((r: any) => r.status === 'approved').length;
        const pending = requests.filter((r: any) => r.status === 'pending').length;
        const rejected = requests.filter((r: any) => r.status === 'rejected').length;
        return { total, approved, pending, rejected };
    }, [requests]);

    return (
        <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display pb-20">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 pt-4 md:pt-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary flex items-center gap-1 md:hidden">
                    <span className="material-icons-round">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ประวัติการขอลา</h1>

                {/* Year Selector */}
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y + 543}</option>
                    ))}
                </select>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-3xl mx-auto space-y-6">

                    {/* Stats Summary */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'ทั้งหมด', value: stats.total, color: 'text-primary', bg: 'bg-primary/10' },
                            { label: 'อนุมัติ', value: stats.approved, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                            { label: 'รออนุมัติ', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                            { label: 'ไม่อนุมัติ', value: stats.rejected, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                        ].map((s, i) => (
                            <div key={i} className={`${s.bg} rounded-xl p-3 text-center`}>
                                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Request List */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-16">
                            <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">event_busy</span>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">ไม่มีประวัติการขอลาในปี {selectedYear + 543}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((r: any) => {
                                const badge = getStatusBadge(r.status);
                                const isOT = r.reason?.startsWith('[OT]');
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => navigate(`/request/status/${r.id}`)}
                                        className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                                        {isOT ? 'ขอทำ OT' : r.leave_type_name}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                                                        {badge.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-icons-round text-xs">calendar_today</span>
                                                        {formatThaiDate(r.start_date)} - {formatThaiDate(r.end_date)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-icons-round text-xs">schedule</span>
                                                        {r.total_days} {isOT ? 'ชม.' : 'วัน'}
                                                    </span>
                                                </div>
                                                {r.reason && !isOT && (
                                                    <p className="text-xs text-gray-400 mt-1 truncate">{r.reason}</p>
                                                )}
                                            </div>
                                            <span className="material-icons-round text-gray-300 dark:text-gray-600 group-hover:text-primary text-lg transition-colors">chevron_right</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default LeaveHistoryScreen;
