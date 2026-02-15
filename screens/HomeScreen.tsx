import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { QUICK_MENU_ITEMS } from '../data';
import { useApi } from '../hooks/useApi';
import { API_BASE, getNotifications, getLeaveQuotas, getAttendance, getNews, getEmployee, markNotificationRead, markAllNotificationsRead, deleteNotification, clockIn, clockOut, checkLocation, getLeaveRequests, updateLeaveRequest, getUploads } from '../services/api';
import { subscribeToPush } from '../services/pushNotifications';
import LocationCheckModal from '../components/LocationCheckModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';

const HomeScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user: authUser, isAdmin } = useAuth();
    const empId = authUser?.id || '';
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifTab, setNotifTab] = useState<'unread' | 'read'>('unread');
    const notifRef = useRef<HTMLDivElement>(null);

    // === APPROVAL SYSTEM STATE ===
    const [approvalDetail, setApprovalDetail] = useState<any>(null);
    const [approvalAttachments, setApprovalAttachments] = useState<any[]>([]);
    const [approvalLoading, setApprovalLoading] = useState<string | null>(null);

    // Live clock + greeting
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000); // update every 30s
        return () => clearInterval(timer);
    }, []);
    const hour = now.getHours();
    const greeting = hour >= 5 && hour < 12 ? 'สวัสดีตอนเช้า' : hour >= 12 && hour < 17 ? 'สวัสดีตอนบ่าย' : hour >= 17 && hour < 20 ? 'สวัสดีตอนเย็น' : 'สวัสดีตอนค่ำ';
    const clockStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    // Auto-subscribe to push notifications
    useEffect(() => {
        if (empId) {
            subscribeToPush(empId).catch(() => { });
        }
    }, [empId]);

    // Fetch data from API
    const { data: rawNotifications, refetch: refetchNotifs } = useApi(() => getNotifications(empId), [empId]);
    const { data: rawQuotas } = useApi(() => getLeaveQuotas(empId), [empId]);
    const { data: rawAttendance, refetch: refetchAttendance } = useApi(() => getAttendance(empId), [empId]);
    const { data: allNews } = useApi(() => getNews(), []);
    const { data: currentUser } = useApi(() => getEmployee(empId), [empId]);
    const { data: pendingRequests, refetch: refetchPending } = useApi(
        () => empId ? getLeaveRequests({ status: 'pending' }) : Promise.resolve([]),
        [empId]
    );

    // Filter: show only requests where I am the current pending approver
    const myPendingRequests = useMemo(() => {
        if (!pendingRequests) return [];
        return (pendingRequests as any[]).filter((r: any) => {
            // HR/Admin sees all pending
            if (isAdmin) return true;
            // Tier 1 approver: show if tier1 is pending and I'm the expected approver
            if (r.expected_approver1_id === empId && r.tier1_status === 'pending') return true;
            // Tier 2 approver: show if tier1 is done and tier2 is pending and I'm the expected approver
            if (r.expected_approver2_id === empId && r.tier1_status === 'approved' && r.tier2_status === 'pending') return true;
            return false;
        });
    }, [pendingRequests, empId, isAdmin]);

    const pendingCount = myPendingRequests.length;

    // Categorize pending
    const pendingLeave = useMemo(() => myPendingRequests.filter((r: any) => !r.reason?.startsWith('[OT]')), [myPendingRequests]);
    const pendingOT = useMemo(() => myPendingRequests.filter((r: any) => r.reason?.startsWith('[OT]')), [myPendingRequests]);

    // Open detail modal and fetch attachments
    const openApprovalDetail = async (req: any) => {
        setApprovalDetail(req);
        setApprovalAttachments([]);
        try {
            const isOT = req.reason?.startsWith('[OT]');
            const category = isOT ? 'ot_attachment' : 'leave_attachment';
            const files = await getUploads(category, String(req.id));
            setApprovalAttachments(files || []);
        } catch { }
    };

    // Approve / Reject handler (multi-tier)
    const handleApproval = async (id: number, action: 'approved' | 'rejected') => {
        // Find the request
        const req = myPendingRequests.find((r: any) => r.id === id);
        const tier1Pending = req?.tier1_status === 'pending';
        const hasExpectedApprover1 = !!req?.expected_approver1_id;
        const iAmTier1 = req?.expected_approver1_id === empId;

        // HR bypass detection: HR is approving but tier1 hasn't approved yet
        let isBypass = 0;
        if (action === 'approved' && isAdmin && tier1Pending && hasExpectedApprover1 && !iAmTier1) {
            const confirmed = window.confirm(
                `⚠️ ขั้นที่ 1 (${req.approver1_name || 'หัวหน้างาน'}) ยังไม่อนุมัติ\n\nต้องการอนุมัติข้ามขั้นตอน (Bypass) หรือไม่?`
            );
            if (!confirmed) return;
            isBypass = 1;
        }

        setApprovalLoading(`${id}-${action}`);
        try {
            await updateLeaveRequest(id, { status: action, approved_by: empId, is_bypass: isBypass });
            toast(
                action === 'approved'
                    ? (isBypass ? 'อนุมัติ (Bypass) เรียบร้อย' : 'อนุมัติเรียบร้อย')
                    : 'ไม่อนุมัติเรียบร้อย',
                action === 'approved' ? 'success' : 'error'
            );
            setApprovalDetail(null);
            refetchPending();
            refetchNotifs();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setApprovalLoading(null);
        }
    };

    // Map notifications from DB
    const notifications = (rawNotifications || []).map((n: any) => ({
        id: String(n.id),
        title: n.title,
        message: n.message,
        time: n.created_at ? new Date(n.created_at).toLocaleString('th-TH') : '',
        icon: n.icon || 'notifications',
        iconBg: n.icon_bg || 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: n.icon_color || 'text-blue-600',
        isRead: n.is_read,
        type: n.type || 'system',
    }));

    const unreadCount = notifications.filter((n: any) => !n.isRead).length;

    // Map quotas from DB
    const quotas = (rawQuotas || []).map((q: any) => ({
        id: Number(q.leave_type_id),
        type: q.leave_type_name,
        label: q.leave_type_name,
        remaining: Number(q.remaining || 0),
        total: Number(q.total || 0),
        used: Number(q.used || 0),
        color: q.color || 'blue',
        icon: q.icon || 'event',
        icon_url: q.icon_url || '',
        unit: q.unit || 'วัน',
    }));
    const mainQuotaIds = [1, 2, 3]; // ลาพักร้อน, ลาป่วย, ลากิจ
    const mainQuotas = quotas.filter((q: any) => mainQuotaIds.includes(q.id));
    const otherQuotas = quotas.filter((q: any) => !mainQuotaIds.includes(q.id));
    const [showOtherQuotas, setShowOtherQuotas] = useState(false);

    // Map attendance from DB
    const clockStatus: 'not_clocked_in' | 'clocked_in' | 'completed' = rawAttendance?.clockStatus || 'not_clocked_in';
    const todayRecord = rawAttendance?.today;
    const attendance = rawAttendance ? {
        date: todayRecord?.date ? new Date(todayRecord.date).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' }) : new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: todayRecord?.clock_in ? todayRecord.clock_in.substring(0, 5) : '--:--',
        location: todayRecord?.location || 'ไม่ระบุ',
        isOffsite: todayRecord?.is_offsite === '1' || todayRecord?.is_offsite === 1,
        lastCheckout: rawAttendance.lastCheckout ? `เช็คเอาท์ล่าสุด: ${rawAttendance.lastCheckout.clock_out?.substring(0, 5) || '--:--'}` : 'ยังไม่มีข้อมูล',
        clockOutTime: todayRecord?.clock_out ? todayRecord.clock_out.substring(0, 5) : null,
    } : { date: new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' }), time: '--:--', location: 'ไม่ระบุ', isOffsite: false, lastCheckout: '', clockOutTime: null };

    // Clock-in/out handler
    const [clockLoading, setClockLoading] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationResult, setLocationResult] = useState<{ matched: boolean; location_name: string; distance: number } | null>(null);
    const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [pendingAction, setPendingAction] = useState<'clock_in' | 'clock_out'>('clock_in');
    const [confirmLoading, setConfirmLoading] = useState(false);

    const [gpsLoading, setGpsLoading] = useState(false);

    const getCurrentPosition = (): Promise<{ latitude: number; longitude: number }> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('เบราว์เซอร์ไม่รองรับ GPS'));
                return;
            }

            // Try high accuracy first
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                (highAccErr) => {
                    // If high accuracy failed, try low accuracy as fallback
                    if (highAccErr.code === 2 || highAccErr.code === 3) {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                            (lowAccErr) => reject(lowAccErr),
                            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
                        );
                    } else {
                        reject(highAccErr);
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    };

    // Clock action: just call getCurrentPosition directly — browser auto-prompts for permission
    const handleClockAction = async () => {
        if (clockStatus === 'completed' || clockLoading) return;
        setClockLoading(true);
        setGpsLoading(true);
        try {
            const coords = await getCurrentPosition();
            setGpsLoading(false);
            const result = await checkLocation(coords.latitude, coords.longitude);
            setPendingCoords(coords);
            setPendingAction(clockStatus === 'not_clocked_in' ? 'clock_in' : 'clock_out');
            setLocationResult(result);
            setShowLocationModal(true);
        } catch (err: any) {
            setGpsLoading(false);
            if (err.code === 1) {
                // Permission denied OR Location Services off
                toast('ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาเปิด Location/GPS ในตั้งค่าเครื่อง แล้วลองใหม่', 'error');
            } else if (err.code === 2) {
                toast('ไม่พบตำแหน่ง กรุณาเปิด GPS แล้วลองใหม่', 'error');
            } else {
                toast('ดึงตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
            }
        } finally {
            setClockLoading(false);
        }
    };

    // Step 2: User confirms in modal → actually record
    const handleConfirmClock = async () => {
        if (!pendingCoords) return;
        setConfirmLoading(true);
        try {
            if (pendingAction === 'clock_in') {
                await clockIn({ employee_id: empId, latitude: pendingCoords.latitude, longitude: pendingCoords.longitude });
            } else if (todayRecord?.id) {
                await clockOut(Number(todayRecord.id), pendingCoords);
            }
            setShowLocationModal(false);
            refetchAttendance();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setConfirmLoading(false);
        }
    };

    // Featured news = first pinned article
    const featuredNews = allNews?.find((a: any) => a.is_pinned) || (allNews && allNews[0]) || null;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotifications]);

    const markAsRead = async (id: string) => {
        try {
            await markNotificationRead(Number(id));
            refetchNotifs();
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsRead(empId);
            refetchNotifs();
        } catch (err) {
            console.error('Failed to mark all as read', err);
        }
    };

    const handleDeleteNotif = async (id: string) => {
        try {
            await deleteNotification(Number(id));
            refetchNotifs();
        } catch (err) {
            console.error('Failed to delete notification', err);
        }
    };

    // Filtered notifications for tabs
    const unreadNotifs = notifications.filter((n: any) => !n.isRead);
    const readNotifs = notifications.filter((n: any) => n.isRead);
    const displayedNotifs = notifTab === 'unread' ? unreadNotifs : readNotifs;

    return (
        <div className="pt-6 md:pt-8 pb-24 md:pb-8 px-4 md:px-8 max-w-7xl mx-auto min-h-full">
            {/* Header */}
            <header className="mb-6 md:mb-10 flex justify-between items-center">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{greeting}, <span className="font-medium">{clockStr}</span></p>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{currentUser?.name || 'ผู้ใช้งาน'}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {/* Notification Bell */}
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => setShowNotifications(prev => !prev)}
                            className={`relative p-2 rounded-full shadow-sm border transition-all duration-200 ${showNotifications
                                ? 'bg-primary/10 border-primary/30 ring-2 ring-primary/20'
                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <span className={`material-icons-round transition-colors ${showNotifications ? 'text-primary' : 'text-gray-600 dark:text-gray-300'}`}>
                                {showNotifications ? 'notifications_active' : 'notifications_none'}
                            </span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-white leading-none">{unreadCount}</span>
                                </span>
                            )}
                        </button>

                        {/* Notification Dropdown Panel */}
                        {showNotifications && (
                            <div
                                className="fixed inset-x-0 top-14 mx-3 md:mx-0 md:absolute md:inset-auto md:right-0 md:top-[calc(100%+8px)] md:w-[400px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden"
                                style={{ animation: 'notifSlideIn 0.2s ease-out' }}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-base">การแจ้งเตือน</h3>
                                        {unreadCount > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{unreadCount} ใหม่</span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && notifTab === 'unread' && (
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            className="text-xs text-primary font-semibold hover:text-blue-700 transition-colors"
                                        >
                                            อ่านทั้งหมด
                                        </button>
                                    )}
                                </div>

                                {/* Tab Bar */}
                                <div className="flex border-b border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={() => setNotifTab('unread')}
                                        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 ${notifTab === 'unread' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                                    >
                                        ยังไม่อ่าน{unreadCount > 0 ? ` (${unreadCount})` : ''}
                                    </button>
                                    <button
                                        onClick={() => setNotifTab('read')}
                                        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 ${notifTab === 'read' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                                    >
                                        อ่านแล้ว
                                    </button>
                                </div>

                                {/* Notification List */}
                                <div className="max-h-[360px] overflow-y-auto scrollbar-hide divide-y divide-gray-50 dark:divide-gray-800">
                                    {displayedNotifs.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <span className="material-icons-round text-4xl text-gray-300 dark:text-gray-600 mb-2 block">
                                                {notifTab === 'unread' ? 'notifications_none' : 'done_all'}
                                            </span>
                                            <p className="text-sm text-gray-400 dark:text-gray-500">
                                                {notifTab === 'unread' ? 'ไม่มีการแจ้งเตือนใหม่' : 'ไม่มีรายการที่อ่านแล้ว'}
                                            </p>
                                        </div>
                                    ) : (
                                        displayedNotifs.map((notif: any) => (
                                            <div
                                                key={notif.id}
                                                className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${!notif.isRead ? 'bg-primary/[0.03] dark:bg-primary/[0.05]' : ''
                                                    }`}
                                            >
                                                {/* Icon */}
                                                <div className={`w-10 h-10 rounded-xl ${notif.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                                                    <span className={`material-icons-round text-lg ${notif.iconColor}`}>{notif.icon}</span>
                                                </div>

                                                {/* Content — clickable for navigation */}
                                                <button
                                                    onClick={() => {
                                                        if (!notif.isRead) markAsRead(notif.id);
                                                        if (notif.type === 'leave') navigate('/request/status/123');
                                                        else if (notif.type === 'payslip') navigate('/payslips');
                                                        else if (notif.type === 'news') navigate('/news');
                                                        setShowNotifications(false);
                                                    }}
                                                    className="flex-1 min-w-0 text-left"
                                                >
                                                    <p className={`text-sm leading-tight ${!notif.isRead ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">{notif.time}</p>
                                                </button>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {/* Mark as read button — only for unread tab */}
                                                    {!notif.isRead && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                                            title="อ่านแล้ว"
                                                            className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition-colors"
                                                        >
                                                            <span className="material-icons-round text-base">check_circle_outline</span>
                                                        </button>
                                                    )}
                                                    {/* Delete button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteNotif(notif.id); }}
                                                        title="ลบ"
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <span className="material-icons-round text-base">close</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="border-t border-gray-100 dark:border-gray-800 p-3">
                                    <button className="w-full text-center text-sm text-primary font-semibold py-2 rounded-xl hover:bg-primary/5 transition-colors">
                                        ดูการแจ้งเตือนทั้งหมด
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <img
                        alt="Profile"
                        className="md:hidden w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 shadow-sm object-cover"
                        src={currentUser?.avatar || 'https://picsum.photos/id/64/200/200'}
                    />
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">

                {/* Left Column (Mobile: Top, Desktop: Left) */}
                <div className="md:col-span-5 lg:col-span-4 space-y-8">
                    {/* Attendance Card */}
                    <section>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="flex flex-col items-center justify-center text-center">
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{attendance.date}</p>

                                {/* Clock-in time / Clock-out time */}
                                {clockStatus === 'completed' ? (
                                    <div className="mb-2">
                                        <div className="flex items-center justify-center gap-4">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">เข้า</p>
                                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{attendance.time}</h2>
                                            </div>
                                            <span className="material-icons-round text-gray-300 text-lg">arrow_forward</span>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">ออก</p>
                                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{attendance.clockOutTime || '--:--'}</h2>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                                        {clockStatus === 'clocked_in' ? attendance.time : '--:--'}
                                        <span className="text-lg font-medium text-gray-400 ml-1">น.</span>
                                    </h2>
                                )}

                                {/* Location badge */}
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full mb-6 ${attendance.isOffsite
                                    ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
                                    : 'text-primary bg-primary/10'
                                    }`}>
                                    <span className="material-icons-round text-sm">{attendance.isOffsite ? 'wrong_location' : 'location_on'}</span>
                                    <span className="text-xs font-semibold">{attendance.location}</span>
                                </div>

                                {/* Clock-in/out Button */}
                                <div className="relative w-full">
                                    {clockStatus === 'not_clocked_in' && (
                                        <button
                                            onClick={handleClockAction}
                                            disabled={clockLoading}
                                            className="w-full bg-primary hover:bg-blue-600 active:scale-[0.98] transition-all duration-200 text-white font-semibold py-4 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 group disabled:opacity-70"
                                        >
                                            {clockLoading ? (
                                                <span className="material-icons-round animate-spin">autorenew</span>
                                            ) : (
                                                <>
                                                    <div className="bg-white/20 p-1.5 rounded-lg group-hover:bg-white/30 transition-colors">
                                                        <span className="material-icons-round">fingerprint</span>
                                                    </div>
                                                    <span className="text-lg">ลงเวลาเข้า</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {clockStatus === 'clocked_in' && (
                                        <button
                                            onClick={handleClockAction}
                                            disabled={clockLoading}
                                            className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all duration-200 text-white font-semibold py-4 rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 group disabled:opacity-70"
                                        >
                                            {clockLoading ? (
                                                <span className="material-icons-round animate-spin">autorenew</span>
                                            ) : (
                                                <>
                                                    <div className="bg-white/20 p-1.5 rounded-lg group-hover:bg-white/30 transition-colors">
                                                        <span className="material-icons-round">logout</span>
                                                    </div>
                                                    <span className="text-lg">ลงเวลาออก</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {clockStatus === 'completed' && (
                                        <div className="w-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 font-semibold py-4 rounded-xl flex items-center justify-center gap-2">
                                            <span className="material-icons-round">check_circle</span>
                                            <span className="text-lg">ลงเวลาครบแล้ว</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                                    <span className="material-icons-round text-sm">history</span>
                                    <span>{attendance.lastCheckout}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Quick Menu */}
                    <section>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">เมนูด่วน</h3>
                        <div className={`grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} md:grid-cols-2 gap-4`}>
                            {QUICK_MENU_ITEMS.filter(item => !item.adminOnly || isAdmin).map((item, i) => {
                                const action = item.path ? () => navigate(item.path!) : undefined;
                                return (
                                    <button key={i} onClick={action} className="flex flex-col items-center md:flex-row md:px-4 md:py-3 gap-2 md:gap-4 group md:bg-white md:dark:bg-gray-800 md:rounded-xl md:border md:border-gray-100 md:dark:border-gray-700 md:shadow-sm md:hover:shadow-md transition-all relative">
                                        <div className="w-14 h-14 md:w-10 md:h-10 rounded-2xl md:rounded-lg bg-white dark:bg-gray-800 md:bg-primary/10 border border-gray-200 dark:border-gray-700 md:border-none flex items-center justify-center shadow-sm md:shadow-none group-active:scale-95 transition-transform relative">
                                            <span className="material-icons-round text-primary text-2xl md:text-xl">{item.icon}</span>
                                            {/* Notification Dot */}
                                            {item.hasNotif && (
                                                <span className="absolute top-3 right-3 md:top-2 md:right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
                                            )}
                                        </div>
                                        <span className="text-xs md:text-sm text-center md:text-left font-medium text-gray-600 dark:text-gray-300 md:group-hover:text-primary transition-colors">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Pending Approvals (Approvers + Admin) */}
                    {pendingCount > 0 && (
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">รออนุมัติ</h3>
                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
                                </div>
                            </div>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide pr-1">
                                {[...pendingOT, ...pendingLeave].map((req: any) => {
                                    const isOT = req.reason?.startsWith('[OT]');
                                    return (
                                        <button key={req.id} onClick={() => openApprovalDetail(req)}
                                            className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3.5 shadow-sm hover:shadow-md transition-all active:scale-[0.99] text-left">
                                            <div className="flex items-center gap-3">
                                                <img src={req.employee_avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(req.employee_name || '')}
                                                    alt="" className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{req.employee_name}</p>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isOT ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : `bg-${req.leave_type_color || 'gray'}-100 dark:bg-${req.leave_type_color || 'gray'}-900/30 text-${req.leave_type_color || 'gray'}-600`}`}>
                                                            {isOT ? 'OT' : req.leave_type_name}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {req.department || 'ไม่ระบุแผนก'} · {isOT ? `${req.total_days} ชม.` : `${req.total_days} วัน`}
                                                    </p>
                                                </div>
                                                <span className="material-icons-round text-gray-300 dark:text-gray-600 text-lg">chevron_right</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column (Mobile: Bottom, Desktop: Right) */}
                <div className="md:col-span-7 lg:col-span-8 space-y-8">
                    {/* Quotas */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">วันลาคงเหลือ</h3>
                        </div>
                        {/* Main 3 Leave Types as Cards */}
                        <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible pb-3 md:pb-0 scrollbar-hide snap-x">
                            {mainQuotas.map((q: any, idx: number) => (
                                <div key={idx} className="snap-start min-w-[130px] bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                    <div className={`w-9 h-9 rounded-lg bg-${q.color}-100 dark:bg-${q.color}-900/30 flex items-center justify-center mb-2 overflow-hidden`}>
                                        {q.icon_url ? (
                                            <img src={q.icon_url.startsWith('http') ? q.icon_url : `${API_BASE}/${q.icon_url}`} alt="" className="w-7 h-7 object-contain" />
                                        ) : (
                                            <span className={`material-icons-round text-xl text-${q.color}-600 dark:text-${q.color}-400`}>{q.icon}</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{q.remaining < 0 ? '∞' : q.remaining}</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-tight">{q.label.split(' (')[0]}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">ใช้ {q.used}/{q.total} {q.unit}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Other Leave Types — Compact Data Table */}
                        {otherQuotas.length > 0 && (
                            <div className="mt-3">
                                <button onClick={() => setShowOtherQuotas(!showOtherQuotas)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-primary transition-colors">
                                    <span className="material-icons-round text-sm" style={{ transform: showOtherQuotas ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>expand_more</span>
                                    วันลาอื่นๆ ({otherQuotas.length})
                                </button>
                                {showOtherQuotas && (
                                    <div className="mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">ประเภท</th>
                                                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-500">ใช้</th>
                                                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-500">ทั้งหมด</th>
                                                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">คงเหลือ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {otherQuotas.map((q: any, idx: number) => (
                                                    <tr key={idx} className="border-b last:border-0 border-gray-50 dark:border-gray-800">
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                {q.icon_url ? (
                                                                    <img src={q.icon_url.startsWith('http') ? q.icon_url : `${API_BASE}/${q.icon_url}`} alt="" className="w-5 h-5 object-contain" />
                                                                ) : (
                                                                    <span className={`material-icons-round text-sm text-${q.color}-500`}>{q.icon}</span>
                                                                )}
                                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{q.label.split(' (')[0]}</span>
                                                            </div>
                                                        </td>
                                                        <td className="text-center px-2 py-2 text-xs text-gray-600 dark:text-gray-400">{q.used}</td>
                                                        <td className="text-center px-2 py-2 text-xs text-gray-600 dark:text-gray-400">{q.total === 0 ? '∞' : q.total}</td>
                                                        <td className="text-center px-3 py-2">
                                                            <span className={`text-xs font-bold ${q.remaining < 0 ? 'text-green-600' : q.remaining === 0 ? 'text-red-500' : 'text-primary'}`}>
                                                                {q.remaining < 0 ? '∞' : q.remaining} {q.unit}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* News Feed Preview */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">ข่าวประชาสัมพันธ์</h3>
                            <button onClick={() => navigate('/news')} className="text-sm font-medium text-primary hover:text-blue-600">ดูทั้งหมด</button>
                        </div>
                        <div className="space-y-4 md:grid md:grid-cols-2 md:space-y-0 md:gap-4">
                            {/* Featured News */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 relative md:col-span-2 group cursor-pointer">
                                <div className="absolute top-3 right-3 z-10 bg-white/90 dark:bg-black/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                                    <span className="material-icons-round text-primary text-sm block">push_pin</span>
                                </div>
                                <div className="relative h-40 md:h-56 overflow-hidden">
                                    {featuredNews && <img alt="News" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={featuredNews.image} />}
                                    <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide text-gray-800 dark:text-white">
                                        {featuredNews?.is_pinned ? 'ประกาศสำคัญ' : 'ข่าวสาร'}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                        <span className="font-medium text-primary">{featuredNews?.department || ''}</span>
                                        <span>•</span>
                                        <span>{featuredNews?.published_at ? new Date(featuredNews.published_at).toLocaleDateString('th-TH') : ''}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{featuredNews?.title || ''}</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{featuredNews?.content || ''}</p>
                                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                                        <div className="flex gap-4">
                                            <button className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors text-sm">
                                                <span className="material-icons-round text-lg">favorite_border</span>
                                                <span>{featuredNews?.likes || 0}</span>
                                            </button>
                                            <button className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors text-sm">
                                                <span className="material-icons-round text-lg">chat_bubble_outline</span>
                                                <span>{featuredNews?.comments || 0}</span>
                                            </button>
                                        </div>
                                        <button className="ml-auto text-gray-400 hover:text-gray-600">
                                            <span className="material-icons-round">share</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Approval Detail Modal */}
            {approvalDetail && (
                <ApprovalDetailModal
                    req={approvalDetail}
                    attachments={approvalAttachments}
                    onClose={() => setApprovalDetail(null)}
                    onApprove={() => handleApproval(approvalDetail.id, 'approved')}
                    onReject={() => handleApproval(approvalDetail.id, 'rejected')}
                    loading={approvalLoading}
                    isAdmin={isAdmin}
                    empId={empId}
                />
            )}



            {/* Location Check Modal */}
            {showLocationModal && locationResult && (
                <LocationCheckModal
                    result={locationResult}
                    action={pendingAction}
                    loading={confirmLoading}
                    onConfirm={handleConfirmClock}
                    onClose={() => setShowLocationModal(false)}
                />
            )}

            {/* Animation Keyframes */}
            <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

            {/* Version badge for deployment verification */}
            <div className="fixed bottom-20 left-4 z-10 opacity-30 text-[10px] text-gray-400 font-mono">v2.1</div>
        </div>
    );
};

// === Approval Detail Modal (rendered via Portal) ===
function ApprovalDetailModal({ req, attachments, onClose, onApprove, onReject, loading, isAdmin, empId }: {
    req: any; attachments: any[]; onClose: () => void;
    onApprove: () => void; onReject: () => void; loading: string | null;
    isAdmin: boolean; empId: string;
}) {
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const isOT = req.reason?.startsWith('[OT]');
    const reasonText = isOT ? req.reason.replace('[OT] ', '').replace(/^\[OT\]\s*/, '') : req.reason;
    const startDate = req.start_date ? new Date(req.start_date) : null;
    const endDate = req.end_date ? new Date(req.end_date) : null;
    const fmtDate = (d: Date | null) => d ? d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const fmtTime = (d: Date | null) => d ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';

    const imageAttachments = attachments.filter((f: any) => f.mime_type?.startsWith('image/'));
    const otherAttachments = attachments.filter((f: any) => !f.mime_type?.startsWith('image/'));

    const modal = (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-gray-800 w-full sm:w-[420px] sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 z-10">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">รายละเอียดคำขอ</h3>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <span className="material-icons-round text-gray-400">close</span>
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    {/* Employee Profile */}
                    <div className="flex items-center gap-3">
                        <img src={req.employee_avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(req.employee_name || '')}
                            alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700" />
                        <div>
                            <p className="text-base font-bold text-gray-900 dark:text-white">{req.employee_name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{req.department || 'ไม่ระบุแผนก'}</p>
                        </div>
                    </div>

                    {/* Type Badge */}
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${isOT ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : `bg-${req.leave_type_color || 'gray'}-100 dark:bg-${req.leave_type_color || 'gray'}-900/30 text-${req.leave_type_color || 'gray'}-700`}`}>
                        <span className="material-icons-round text-sm">{isOT ? 'schedule' : 'event'}</span>
                        {isOT ? 'ขอ OT' : req.leave_type_name}
                    </div>

                    {/* Date / Time Info */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{isOT ? 'วันที่' : 'วันเริ่ม'}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{fmtDate(startDate)} {isOT && fmtTime(startDate)}</span>
                        </div>
                        {!isOT && (<div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">วันสิ้นสุด</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{fmtDate(endDate)}</span>
                        </div>)}
                        {isOT && (<div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">เวลา</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{fmtTime(startDate)} – {fmtTime(endDate)}</span>
                        </div>)}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{isOT ? 'ชั่วโมง OT' : 'จำนวนวัน'}</span>
                            <span className="font-bold text-lg text-primary">{req.total_days} {isOT ? 'ชม.' : 'วัน'}</span>
                        </div>
                    </div>

                    {/* Reason */}
                    {reasonText && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">เหตุผล</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{reasonText}</p>
                        </div>
                    )}

                    {/* Image Attachments — Compact thumbnails with Lightbox */}
                    {imageAttachments.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">รูปหลักฐาน</p>
                            <div className="space-y-1.5">
                                {imageAttachments.map((file: any) => (
                                    <button key={file.id} onClick={() => setLightboxUrl(file.url)}
                                        className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl py-2 px-3 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
                                        <img src={file.url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-600" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.original_name}</p>
                                            <p className="text-xs text-gray-400">{(file.file_size / 1024).toFixed(0)} KB · กดเพื่อขยาย</p>
                                        </div>
                                        <span className="material-icons-round text-gray-400 text-lg shrink-0">zoom_in</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Non-image Attachments */}
                    {otherAttachments.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">เอกสารแนบ</p>
                            <div className="space-y-2">
                                {otherAttachments.map((file: any) => (
                                    <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl py-2.5 px-4 border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                                        <span className="material-icons-round text-blue-500 text-lg">description</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.original_name}</p>
                                            <p className="text-xs text-gray-400">{(file.file_size / 1024).toFixed(0)} KB</p>
                                        </div>
                                        <span className="material-icons-round text-blue-400 text-sm">open_in_new</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ═══ Approval Timeline ═══ */}
                    {(req.expected_approver1_id || req.expected_approver2_id) && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะการอนุมัติ</p>
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-0">
                                {/* Tier 1 */}
                                {req.expected_approver1_id && (
                                    <div className="flex items-start gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                                ${req.tier1_status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                                    : req.tier1_status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                                        : req.tier1_status === 'skipped' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                                                <span className="material-icons-round text-sm">
                                                    {req.tier1_status === 'approved' ? 'check_circle'
                                                        : req.tier1_status === 'rejected' ? 'cancel'
                                                            : req.tier1_status === 'skipped' ? 'fast_forward'
                                                                : 'hourglass_empty'}
                                                </span>
                                            </div>
                                            {req.expected_approver2_id && <div className="w-0.5 h-6 bg-gray-200 dark:bg-gray-700" />}
                                        </div>
                                        <div className="flex-1 pb-2">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">ขั้นที่ 1 — {req.approver1_name || 'หัวหน้างาน'}</p>
                                            <p className={`text-xs font-medium
                                                ${req.tier1_status === 'approved' ? 'text-green-600'
                                                    : req.tier1_status === 'rejected' ? 'text-red-600'
                                                        : req.tier1_status === 'skipped' ? 'text-amber-600'
                                                            : 'text-gray-400'}`}>
                                                {req.tier1_status === 'approved' ? `✅ อนุมัติแล้ว${req.tier1_at ? ' · ' + new Date(req.tier1_at).toLocaleString('th-TH') : ''}`
                                                    : req.tier1_status === 'rejected' ? `❌ ไม่อนุมัติ${req.tier1_at ? ' · ' + new Date(req.tier1_at).toLocaleString('th-TH') : ''}`
                                                        : req.tier1_status === 'skipped' ? '⚠️ ข้ามขั้นตอน (Bypass)'
                                                            : '⏳ รออนุมัติ'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Tier 2 */}
                                {req.expected_approver2_id && (
                                    <div className="flex items-start gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                                ${req.tier2_status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                                    : req.tier2_status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                                                <span className="material-icons-round text-sm">
                                                    {req.tier2_status === 'approved' ? 'check_circle'
                                                        : req.tier2_status === 'rejected' ? 'cancel'
                                                            : 'hourglass_empty'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">ขั้นที่ 2 — {req.approver2_name || 'HR / ผู้บริหาร'}</p>
                                            <p className={`text-xs font-medium
                                                ${req.tier2_status === 'approved' ? 'text-green-600'
                                                    : req.tier2_status === 'rejected' ? 'text-red-600'
                                                        : 'text-gray-400'}`}>
                                                {req.tier2_status === 'approved' ? `✅ อนุมัติแล้ว${req.tier2_at ? ' · ' + new Date(req.tier2_at).toLocaleString('th-TH') : ''}`
                                                    : req.tier2_status === 'rejected' ? `❌ ไม่อนุมัติ${req.tier2_at ? ' · ' + new Date(req.tier2_at).toLocaleString('th-TH') : ''}`
                                                        : '⏳ รออนุมัติ'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Bypass Warning Banner */}
                            {req.is_bypass == 1 && (
                                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
                                    <span className="material-icons-round text-amber-500 text-lg">warning</span>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">เอกสารนี้อนุมัติ Bypass — ขั้นที่ 1 ยังไม่ได้อนุมัติ</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit Date */}
                    <p className="text-xs text-gray-400 text-center">ส่งเมื่อ {req.created_at ? new Date(req.created_at).toLocaleString('th-TH') : '-'}</p>
                </div>

                {/* Action Buttons */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 flex gap-3">
                    <button onClick={onReject} disabled={!!loading}
                        className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold py-3.5 rounded-xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading === `${req.id}-rejected` ? <span className="material-icons-round animate-spin text-sm">autorenew</span> : <span className="material-icons-round text-sm">close</span>}
                        ไม่อนุมัติ
                    </button>
                    <button onClick={onApprove} disabled={!!loading}
                        className="flex-1 bg-green-600 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-green-600/30 hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading === `${req.id}-approved` ? <span className="material-icons-round animate-spin text-sm">autorenew</span> : <span className="material-icons-round text-sm">check</span>}
                        อนุมัติ
                    </button>
                </div>
            </div>

            {/* Image Lightbox */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}>
                    <button onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
                        className="absolute top-4 right-4 p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 transition-colors z-10">
                        <span className="material-icons-round text-white text-2xl">close</span>
                    </button>
                    <img src={lightboxUrl} alt="หลักฐาน" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
}

export default HomeScreen;