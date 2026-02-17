import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { API_BASE, getAuthHeaders, getLeaveRequests, updateLeaveRequest, getTimeRecords, updateTimeRecord } from '../services/api';

type AdminTab = 'leave' | 'time';

function formatThaiDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'approved': return { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
        case 'rejected': return { label: 'ไม่อนุมัติ', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
        default: return { label: 'รออนุมัติ', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    }
}

const LeaveApprovalScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user: authUser, isAdmin } = useAuth();
    const empId = authUser?.id || '';

    const [adminTab, setAdminTab] = useState<AdminTab>('leave');
    const [tab, setTab] = useState<'pending' | 'all'>('pending');
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // ─── Leave Requests ───
    const { data: allRequests = [], loading: loadingLeave, refetch: refetchLeave } = useApi(
        () => isAdmin
            ? getLeaveRequests({ status: 'pending' })
            : getLeaveRequests({ employee_id: '' }).then(() => []),
        [empId, isAdmin]
    );

    const { data: approverRequests = [] } = useApi(
        () => empId ? fetch(`${API_BASE}/leave_requests.php?approver_id=${empId}`, { headers: getAuthHeaders() }).then(r => r.json()) : Promise.resolve([]),
        [empId]
    );

    const leaveRequests = isAdmin ? (allRequests || []) : (approverRequests || []);
    const pendingLeave = leaveRequests.filter((r: any) => r.status === 'pending');
    const historyLeave = leaveRequests.filter((r: any) => r.status !== 'pending');

    // ─── Time Records ───
    const { data: allTimeRecords = [], loading: loadingTime, refetch: refetchTime } = useApi(
        () => isAdmin
            ? getTimeRecords({ status: 'pending' })
            : getTimeRecords({ approver_id: empId }),
        [empId, isAdmin]
    );

    const pendingTime = (allTimeRecords || []).filter((r: any) => r.status === 'pending');
    const historyTime = (allTimeRecords || []).filter((r: any) => r.status !== 'pending');

    // ─── Current display data ───
    const loading = adminTab === 'leave' ? loadingLeave : loadingTime;
    const pendingRequests = adminTab === 'leave' ? pendingLeave : pendingTime;
    const historyRequests = adminTab === 'leave' ? historyLeave : historyTime;
    const displayRequests = tab === 'pending' ? pendingRequests : historyRequests;

    const refetchAll = useCallback(() => {
        refetchLeave();
        refetchTime();
    }, [refetchLeave, refetchTime]);

    // Handle approve/reject for leave
    const handleLeaveAction = useCallback(async (requestId: number, action: 'approve' | 'reject') => {
        setActionLoading(requestId);
        try {
            await updateLeaveRequest(requestId, { status: action === 'approve' ? 'approved' : 'rejected', approved_by: empId });
            refetchAll();
        } catch (e) {
            console.error('Action failed:', e);
        } finally {
            setActionLoading(null);
        }
    }, [empId, refetchAll]);

    // Handle approve/reject for time records
    const handleTimeAction = useCallback(async (recordId: number, action: 'approve' | 'reject') => {
        setActionLoading(recordId);
        try {
            await updateTimeRecord(recordId, { status: action === 'approve' ? 'approved' : 'rejected', approved_by: empId });
            refetchAll();
        } catch (e) {
            console.error('Action failed:', e);
        } finally {
            setActionLoading(null);
        }
    }, [empId, refetchAll]);

    const handleAction = adminTab === 'leave' ? handleLeaveAction : handleTimeAction;

    return (
        <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display pb-20">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 pt-4 md:pt-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary flex items-center gap-1 md:hidden">
                    <span className="material-icons-round">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">อนุมัติคำขอ</h1>
                <div className="w-10 md:hidden"></div>
            </header>

            {/* Admin Category Tabs */}
            <div className="sticky top-[60px] z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                <div className="flex">
                    {[
                        { key: 'leave' as AdminTab, label: 'ลา / OT', icon: 'event_busy', count: pendingLeave.length },
                        { key: 'time' as AdminTab, label: 'บันทึกเวลา', icon: 'edit_calendar', count: pendingTime.length },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setAdminTab(t.key); setTab('pending'); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all relative
                                ${adminTab === t.key
                                    ? 'text-primary'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <span className="material-icons-round text-base">{t.icon}</span>
                            {t.label}
                            {t.count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{t.count}</span>
                            )}
                            {adminTab === t.key && (
                                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Pending Count Banner */}
            {pendingRequests.length > 0 && (
                <div className="mx-4 mt-4 md:mx-auto md:max-w-3xl md:w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
                        <span className="material-icons-round text-amber-600 text-xl">pending_actions</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            มี {pendingRequests.length} คำขอรออนุมัติ
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">กรุณาตรวจสอบและดำเนินการ</p>
                    </div>
                </div>
            )}

            {/* Status Tabs */}
            <div className="px-4 pt-4 md:px-0 md:max-w-3xl md:mx-auto md:w-full">
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    <button
                        onClick={() => setTab('pending')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${tab === 'pending' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        รออนุมัติ ({pendingRequests.length})
                    </button>
                    <button
                        onClick={() => setTab('all')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${tab === 'all' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        ดำเนินการแล้ว ({historyRequests.length})
                    </button>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-3xl mx-auto space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                        </div>
                    ) : displayRequests.length === 0 ? (
                        <div className="text-center py-16">
                            <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">
                                {tab === 'pending' ? 'check_circle' : 'history'}
                            </span>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">
                                {tab === 'pending' ? 'ไม่มีคำขอรออนุมัติ' : 'ยังไม่มีรายการ'}
                            </p>
                        </div>
                    ) : (
                        displayRequests.map((r: any) => {
                            const badge = getStatusBadge(r.status);
                            const isOT = r.reason?.startsWith('[OT]');
                            const isTimeRecord = adminTab === 'time';

                            return (
                                <div
                                    key={r.id}
                                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all"
                                >
                                    {/* Employee info */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <img
                                            src={r.employee_avatar
                                                ? (r.employee_avatar.startsWith('http') ? r.employee_avatar : `${API_BASE}/${r.employee_avatar}`)
                                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(r.employee_name || '?')}&background=random`}
                                            alt=""
                                            className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{r.employee_name}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{r.department || 'ไม่ระบุแผนก'}</p>
                                        </div>
                                    </div>

                                    {/* Request details */}
                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3">
                                        {isTimeRecord ? (
                                            <>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                                                        <span className="material-icons-round text-sm text-primary">edit_calendar</span>
                                                        บันทึกเวลา
                                                    </span>
                                                    <span className="text-xs text-gray-500">{formatThaiDate(r.record_date)}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-icons-round text-xs">login</span>
                                                        เข้า {r.clock_in_time?.substring(0, 5)}
                                                    </span>
                                                    {r.clock_out_time && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-icons-round text-xs">logout</span>
                                                            ออก {r.clock_out_time?.substring(0, 5)}
                                                        </span>
                                                    )}
                                                    {r.work_location_name && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-icons-round text-xs">place</span>
                                                            {r.work_location_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {isOT ? 'ขอทำ OT' : r.leave_type_name}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{r.total_days} {isOT ? 'ชม.' : 'วัน'}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatThaiDate(r.start_date)} - {formatThaiDate(r.end_date)}
                                                </p>
                                            </>
                                        )}
                                        {r.reason && !isOT && (
                                            <p className="text-xs text-gray-400 mt-1 italic">เหตุผล: {r.reason}</p>
                                        )}
                                    </div>

                                    {/* Tier status */}
                                    {(r.tier1_status || r.tier2_status) && (
                                        <div className="flex items-center gap-4 mb-3 text-[11px] text-gray-500 dark:text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <span className={`material-icons-round text-sm ${r.tier1_status === 'approved' ? 'text-green-500' : r.tier1_status === 'rejected' ? 'text-red-500' : r.tier1_status === 'skipped' ? 'text-gray-400' : 'text-yellow-500'}`}>
                                                    {r.tier1_status === 'approved' ? 'check_circle' : r.tier1_status === 'rejected' ? 'cancel' : r.tier1_status === 'skipped' ? 'skip_next' : 'schedule'}
                                                </span>
                                                ขั้น 1{r.tier1_by_name ? `: ${r.tier1_by_name}` : r.approver1_name ? `: ${r.approver1_name}` : ''}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className={`material-icons-round text-sm ${r.tier2_status === 'approved' ? 'text-green-500' : r.tier2_status === 'rejected' ? 'text-red-500' : r.tier2_status === 'skipped' ? 'text-gray-400' : 'text-yellow-500'}`}>
                                                    {r.tier2_status === 'approved' ? 'check_circle' : r.tier2_status === 'rejected' ? 'cancel' : r.tier2_status === 'skipped' ? 'skip_next' : 'schedule'}
                                                </span>
                                                ขั้น 2{r.tier2_by_name ? `: ${r.tier2_by_name}` : r.approver2_name ? `: ${r.approver2_name}` : ''}
                                            </span>
                                        </div>
                                    )}

                                    {/* Action buttons — only for pending */}
                                    {r.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAction(r.id, 'reject')}
                                                disabled={actionLoading === r.id}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 transition-colors disabled:opacity-50"
                                            >
                                                <span className="material-icons-round text-base">close</span>
                                                ไม่อนุมัติ
                                            </button>
                                            <button
                                                onClick={() => handleAction(r.id, 'approve')}
                                                disabled={actionLoading === r.id}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50"
                                            >
                                                {actionLoading === r.id ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <span className="material-icons-round text-base">check</span>
                                                )}
                                                อนุมัติ
                                            </button>
                                        </div>
                                    )}

                                    {/* History: show who acted */}
                                    {r.status !== 'pending' && r.approved_at && (
                                        <p className="text-xs text-gray-400 text-right">
                                            {r.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}เมื่อ {formatThaiDate(r.approved_at)}
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </main>
        </div>
    );
};

export default LeaveApprovalScreen;
