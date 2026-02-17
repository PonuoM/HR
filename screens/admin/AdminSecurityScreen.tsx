import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getSecurityAlerts, resolveSecurityAlert, resetDeviceBinding } from '../../services/api';
import { useToast } from '../../components/Toast';

interface SecurityAlert {
    id: number;
    alert_type: string;
    employee_id: string;
    employee_name: string;
    original_employee_id: string | null;
    original_employee_name: string | null;
    device_fingerprint: string | null;
    details: string;
    is_resolved: number;
    resolved_by: string | null;
    resolved_by_name: string | null;
    resolved_at: string | null;
    created_at: string;
}

const AdminSecurityScreen: React.FC = () => {
    const { isSuperAdmin } = useAuth();
    const navigate = useNavigate();
    const { toast, confirm: showConfirm } = useToast();
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'unresolved' | 'resolved' | 'all'>('unresolved');

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const data = await getSecurityAlerts(filter);
            setAlerts(data);
        } catch (err: any) {
            toast(err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchAlerts(); }, [filter]);

    if (!isSuperAdmin) {
        return (
            <div className="p-6 text-center">
                <span className="material-icons-round text-5xl text-red-400 mb-3 block">lock</span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
                <p className="text-gray-500">เฉพาะ Superadmin เท่านั้น</p>
            </div>
        );
    }

    const handleResolve = async (id: number) => {
        try {
            await resolveSecurityAlert(id);
            toast('ดำเนินการแก้ไขเรียบร้อย', 'success');
            fetchAlerts();
        } catch (err: any) {
            toast(err.message, 'error');
        }
    };

    const handleResetDevice = async (employeeId: string) => {
        if (!(await showConfirm({ message: `รีเซ็ตอุปกรณ์ของพนักงาน ${employeeId}?`, type: 'warning', confirmText: 'รีเซ็ต' }))) return;
        try {
            await resetDeviceBinding(employeeId);
            toast('รีเซ็ตอุปกรณ์เรียบร้อย', 'success');
        } catch (err: any) {
            toast(err.message, 'error');
        }
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'device_shared': return 'smartphone';
            case 'session_hijack': return 'vpn_key';
            case 'face_mismatch': return 'face_retouching_off';
            default: return 'warning';
        }
    };

    const getAlertColor = (type: string) => {
        switch (type) {
            case 'device_shared': return 'text-orange-500 bg-orange-50 dark:bg-orange-500/10';
            case 'session_hijack': return 'text-red-500 bg-red-50 dark:bg-red-500/10';
            case 'face_mismatch': return 'text-purple-500 bg-purple-50 dark:bg-purple-500/10';
            default: return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10';
        }
    };

    const getAlertLabel = (type: string) => {
        switch (type) {
            case 'device_shared': return 'ใช้อุปกรณ์คนอื่น';
            case 'session_hijack': return 'Session ผิดปกติ';
            case 'face_mismatch': return 'ใบหน้าไม่ตรงกัน';
            default: return 'แจ้งเตือนอื่นๆ';
        }
    };

    return (
        <div className="p-4 pb-24 max-w-xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <span className="material-icons-round text-3xl text-red-500">shield</span>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">แจ้งเตือนความปลอดภัย</h1>
                    <p className="text-sm text-gray-500">ตรวจสอบกิจกรรมที่น่าสงสัย</p>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4">
                {(['unresolved', 'resolved', 'all'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === f
                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                    >
                        {f === 'unresolved' ? 'รอตรวจสอบ' : f === 'resolved' ? 'แก้ไขแล้ว' : 'ทั้งหมด'}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div className="text-center py-10">
                    <span className="material-icons-round text-4xl animate-spin text-primary">autorenew</span>
                </div>
            )}

            {/* Empty state */}
            {!loading && alerts.length === 0 && (
                <div className="text-center py-16">
                    <span className="material-icons-round text-6xl text-green-400 mb-3 block">verified_user</span>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">ไม่มีแจ้งเตือน</h3>
                    <p className="text-gray-500 text-sm">ระบบปลอดภัยครับ ✓</p>
                </div>
            )}

            {/* Alert list */}
            <div className="space-y-3">
                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className={`rounded-2xl border p-4 transition-all ${alert.is_resolved
                            ? 'border-gray-200 dark:border-gray-700 opacity-70'
                            : 'border-red-200 dark:border-red-800 shadow-md'
                            }`}
                    >
                        {/* Alert header */}
                        <div className="flex items-start gap-3 mb-3">
                            <div className={`p-2 rounded-xl ${getAlertColor(alert.alert_type)}`}>
                                <span className="material-icons-round text-xl">{getAlertIcon(alert.alert_type)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getAlertColor(alert.alert_type)}`}>
                                        {getAlertLabel(alert.alert_type)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(alert.created_at).toLocaleDateString('th-TH', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{alert.details}</p>
                            </div>
                        </div>

                        {/* People involved */}
                        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                            <span>
                                <span className="material-icons-round text-sm align-middle mr-1">person</span>
                                {alert.employee_name} ({alert.employee_id})
                            </span>
                            {alert.original_employee_name && (
                                <span>
                                    <span className="material-icons-round text-sm align-middle mr-1">device_hub</span>
                                    เครื่องของ: {alert.original_employee_name}
                                </span>
                            )}
                        </div>

                        {/* Actions */}
                        {!alert.is_resolved && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleResolve(alert.id)}
                                    className="flex-1 py-2 rounded-xl bg-green-500 text-white text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                                >
                                    <span className="material-icons-round text-sm">check_circle</span>
                                    ตรวจสอบแล้ว
                                </button>
                                {alert.employee_id && (
                                    <button
                                        onClick={() => handleResetDevice(alert.employee_id)}
                                        className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                                    >
                                        <span className="material-icons-round text-sm">restart_alt</span>
                                        รีเซ็ตอุปกรณ์
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Resolved info */}
                        {!!alert.is_resolved && (
                            <div className="text-xs text-green-600 dark:text-green-400">
                                <span className="material-icons-round text-sm align-middle mr-1">check</span>
                                แก้ไขโดย {alert.resolved_by_name} | {alert.resolved_at && new Date(alert.resolved_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminSecurityScreen;
