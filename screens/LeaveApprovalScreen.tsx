import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { API_BASE, getLeaveRequests, updateLeaveRequest } from '../services/api';

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

    const [tab, setTab] = useState<'pending' | 'all'>('pending');
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // Fetch all pending requests for this approver (or all if admin)
    const { data: allRequests = [], loading, refetch } = useApi(
        () => isAdmin
            ? getLeaveRequests({ status: 'pending' })
            : getLeaveRequests({ employee_id: '' }).then(() => []),  // fallback
        [empId, isAdmin]
    );

    // For non-admin approvers, fetch requests where they are the approver
    const { data: approverRequests = [] } = useApi(
        () => empId ? fetch(`${API_BASE}/leave_requests.php?approver_id=${empId}`).then(r => r.json()) : Promise.resolve([]),
        [empId]
    );

    // Combine: use approverRequests for non-admin, allRequests for admin
    const requests = isAdmin ? allRequests : approverRequests;
    const pendingRequests = requests.filter((r: any) => r.status === 'pending');
    const historyRequests = requests.filter((r: any) => r.status !== 'pending');
    const displayRequests = tab === 'pending' ? pendingRequests : historyRequests;

    // Handle approve/reject
    const handleAction = useCallback(async (requestId: number, action: 'approve' | 'reject') => {
        setActionLoading(requestId);
        try {
            await updateLeaveRequest(requestId, { status: action === 'approve' ? 'approved' : 'rejected', approved_by: empId });
            refetch();
        } catch (e) {
            console.error('Action failed:', e);
        } finally {
            setActionLoading(null);
        }
    }, [empId, refetch]);

    return (
        <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display pb-20">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 pt-4 md:pt-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary flex items-center gap-1 md:hidden">
                    <span className="material-icons-round">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">อนุมัติลา</h1>
                <div className="w-10 md:hidden"></div>
            </header>

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

            {/* Tabs */}
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
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {isOT ? 'ขอทำ OT' : r.leave_type_name}
                                            </span>
                                            <span className="text-xs text-gray-500">{r.total_days} {isOT ? 'ชม.' : 'วัน'}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatThaiDate(r.start_date)} - {formatThaiDate(r.end_date)}
                                        </p>
                                        {r.reason && !isOT && (
                                            <p className="text-xs text-gray-400 mt-1 italic">เหตุผล: {r.reason}</p>
                                        )}
                                    </div>

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
