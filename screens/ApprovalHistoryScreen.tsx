import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { getLeaveRequests, getTimeRecords } from '../services/api';

type TabKey = 'leave' | 'ot' | 'time';

function formatThaiDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'approved': return { label: 'อนุมัติ', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: 'check_circle' };
        case 'rejected': return { label: 'ไม่อนุมัติ', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: 'cancel' };
        default: return { label: 'รออนุมัติ', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: 'schedule' };
    }
}

function getTierBadge(status: string) {
    switch (status) {
        case 'approved': return { icon: 'check_circle', color: 'text-green-500' };
        case 'rejected': return { icon: 'cancel', color: 'text-red-500' };
        case 'skipped': return { icon: 'skip_next', color: 'text-gray-400' };
        default: return { icon: 'schedule', color: 'text-yellow-500' };
    }
}

const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'leave', label: 'ลางาน', icon: 'event_busy' },
    { key: 'ot', label: 'ขอ OT', icon: 'more_time' },
    { key: 'time', label: 'บันทึกเวลา', icon: 'edit_calendar' },
];

const ApprovalHistoryScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const empId = authUser?.id || '';

    const [activeTab, setActiveTab] = useState<TabKey>('leave');
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
        return years;
    }, [currentYear]);

    // Fetch leave requests (includes OT)
    const { data: allLeaveRequests = [], loading: loadingLeave } = useApi(
        () => getLeaveRequests({ employee_id: empId }), [empId]
    );

    // Fetch time records
    const { data: allTimeRecords = [], loading: loadingTime } = useApi(
        () => getTimeRecords({ employee_id: empId }), [empId]
    );

    // Filter leave (not OT) by year
    const leaveRequests = useMemo(() => {
        return (allLeaveRequests || []).filter((r: any) => {
            const isOT = r.reason?.startsWith('[OT]');
            const year = new Date(r.created_at).getFullYear();
            return !isOT && year === selectedYear;
        });
    }, [allLeaveRequests, selectedYear]);

    // Filter OT by year
    const otRequests = useMemo(() => {
        return (allLeaveRequests || []).filter((r: any) => {
            const isOT = r.reason?.startsWith('[OT]');
            const year = new Date(r.created_at).getFullYear();
            return isOT && year === selectedYear;
        });
    }, [allLeaveRequests, selectedYear]);

    // Filter time records by year
    const timeRecords = useMemo(() => {
        return (allTimeRecords || []).filter((r: any) => {
            const year = new Date(r.created_at || r.record_date).getFullYear();
            return year === selectedYear;
        });
    }, [allTimeRecords, selectedYear]);

    // Get current data based on active tab
    const currentData = activeTab === 'leave' ? leaveRequests : activeTab === 'ot' ? otRequests : timeRecords;
    const loading = activeTab === 'time' ? loadingTime : loadingLeave;

    // Stats for current tab
    const stats = useMemo(() => {
        const total = currentData.length;
        const approved = currentData.filter((r: any) => r.status === 'approved').length;
        const pending = currentData.filter((r: any) => r.status === 'pending').length;
        const rejected = currentData.filter((r: any) => r.status === 'rejected').length;
        return { total, approved, pending, rejected };
    }, [currentData]);

    const renderLeaveItem = useCallback((r: any) => {
        const badge = getStatusBadge(r.status);
        const isOT = r.reason?.startsWith('[OT]');
        const tier1 = getTierBadge(r.tier1_status);
        const tier2 = getTierBadge(r.tier2_status);

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
                        {/* Tier status */}
                        <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                <span className={`material-icons-round text-sm ${tier1.color}`}>{tier1.icon}</span>
                                ขั้น 1{r.tier1_by_name ? `: ${r.tier1_by_name}` : r.approver1_name ? `: ${r.approver1_name}` : ''}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                <span className={`material-icons-round text-sm ${tier2.color}`}>{tier2.icon}</span>
                                ขั้น 2{r.tier2_by_name ? `: ${r.tier2_by_name}` : r.approver2_name ? `: ${r.approver2_name}` : ''}
                            </span>
                        </div>
                    </div>
                    <span className="material-icons-round text-gray-300 dark:text-gray-600 group-hover:text-primary text-lg transition-colors">chevron_right</span>
                </div>
            </button>
        );
    }, [navigate]);

    const renderTimeItem = useCallback((r: any) => {
        const badge = getStatusBadge(r.status);
        const tier1 = getTierBadge(r.tier1_status || 'pending');
        const tier2 = getTierBadge(r.tier2_status || 'pending');

        return (
            <div
                key={r.id}
                className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-left hover:shadow-md hover:border-primary/30 transition-all"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                บันทึกเวลา
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                                {badge.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                                <span className="material-icons-round text-xs">calendar_today</span>
                                {formatThaiDate(r.record_date)}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="material-icons-round text-xs">login</span>
                                {r.clock_in_time?.substring(0, 5)}
                            </span>
                            {r.clock_out_time && (
                                <span className="flex items-center gap-1">
                                    <span className="material-icons-round text-xs">logout</span>
                                    {r.clock_out_time?.substring(0, 5)}
                                </span>
                            )}
                        </div>
                        {r.work_location_name && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                <span className="material-icons-round text-xs">place</span>
                                {r.work_location_name}
                            </p>
                        )}
                        {r.reason && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{r.reason}</p>
                        )}
                        {/* Tier status */}
                        <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                <span className={`material-icons-round text-sm ${tier1.color}`}>{tier1.icon}</span>
                                ขั้น 1{r.tier1_by_name ? `: ${r.tier1_by_name}` : r.approver1_name ? `: ${r.approver1_name}` : ''}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                <span className={`material-icons-round text-sm ${tier2.color}`}>{tier2.icon}</span>
                                ขั้น 2{r.tier2_by_name ? `: ${r.tier2_by_name}` : r.approver2_name ? `: ${r.approver2_name}` : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }, []);

    const emptyMessages: Record<TabKey, string> = {
        leave: `ไม่มีประวัติการขอลาในปี ${selectedYear + 543}`,
        ot: `ไม่มีประวัติการขอ OT ในปี ${selectedYear + 543}`,
        time: `ไม่มีประวัติการบันทึกเวลาในปี ${selectedYear + 543}`,
    };

    const emptyIcons: Record<TabKey, string> = {
        leave: 'event_busy',
        ot: 'more_time',
        time: 'edit_calendar',
    };

    return (
        <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display pb-20">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 pt-4 md:pt-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary flex items-center gap-1 md:hidden">
                    <span className="material-icons-round">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ประวัติการขออนุมัติ</h1>

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

            {/* Tabs */}
            <div className="sticky top-[60px] z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                <div className="flex">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all relative
                                ${activeTab === tab.key
                                    ? 'text-primary'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <span className="material-icons-round text-base">{tab.icon}</span>
                            {tab.label}
                            {activeTab === tab.key && (
                                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

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
                    ) : currentData.length === 0 ? (
                        <div className="text-center py-16">
                            <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">{emptyIcons[activeTab]}</span>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">{emptyMessages[activeTab]}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {currentData.map((r: any) =>
                                activeTab === 'time' ? renderTimeItem(r) : renderLeaveItem(r)
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ApprovalHistoryScreen;
