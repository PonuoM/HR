import React, { useState } from 'react';

interface LocationCheckResult {
    matched: boolean;
    location_name: string;
    distance: number;
}

interface LocationCheckModalProps {
    result: LocationCheckResult;
    action: 'clock_in' | 'clock_out';
    loading: boolean;
    onConfirm: () => void;
    onClose: () => void;
    workedMinutes?: number; // Guard 3: show worked time for clock-out
}

const LocationCheckModal: React.FC<LocationCheckModalProps> = ({ result, action, loading, onConfirm, onClose, workedMinutes }) => {
    const isAllowed = result.matched || action === 'clock_out';
    const actionLabel = action === 'clock_in' ? 'ลงเวลาเข้า' : 'ลงเวลาออก';

    // ─── Guard 3: 2-step confirmation for clock-out ───
    const [clockOutConfirmed, setClockOutConfirmed] = useState(false);

    const handleConfirmClick = () => {
        if (action === 'clock_out' && !clockOutConfirmed) {
            // First tap → show final confirmation state
            setClockOutConfirmed(true);
            return;
        }
        // Second tap (clock-out) or first tap (clock-in) → execute
        onConfirm();
    };

    // Format worked time
    const workedTimeStr = workedMinutes !== undefined
        ? workedMinutes >= 60
            ? `${Math.floor(workedMinutes / 60)} ชม. ${workedMinutes % 60} นาที`
            : `${workedMinutes} นาที`
        : null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-[9990]" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-[9991] flex items-center justify-center p-4">
                <div
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                    style={{ animation: 'locModalSlideUp 0.3s ease-out' }}
                >
                    {/* Header icon */}
                    <div className={`flex items-center justify-center pt-8 pb-4`}>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isAllowed
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                            <span className={`material-icons-round text-4xl ${isAllowed ? 'text-green-500' : 'text-red-500'
                                }`}>
                                {isAllowed ? 'location_on' : 'location_off'}
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 pb-4 text-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            {isAllowed ? 'อยู่ในพื้นที่ทำงาน' : 'อยู่นอกพื้นที่ทำงาน'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            {result.location_name}
                        </p>

                        {/* Distance info */}
                        <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 ${isAllowed
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            }`}>
                            <span className="material-icons-round text-lg">
                                {isAllowed ? 'check_circle' : 'error'}
                            </span>
                            <span className="text-sm font-semibold">
                                {result.distance < 1000
                                    ? `ห่าง ${result.distance} เมตร`
                                    : `ห่าง ${(result.distance / 1000).toFixed(1)} กม.`
                                }
                            </span>
                        </div>

                        {/* ─── Guard 3: Worked time info for clock-out ─── */}
                        {action === 'clock_out' && workedTimeStr && (
                            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 mb-4">
                                <span className="material-icons-round text-lg">schedule</span>
                                <span className="text-sm font-medium">ทำงานมาแล้ว {workedTimeStr}</span>
                            </div>
                        )}

                        {/* 2-step confirmation hint */}
                        {action === 'clock_out' && clockOutConfirmed && (
                            <p className="text-xs text-orange-500 dark:text-orange-400 mb-2 font-semibold animate-pulse">
                                กดอีกครั้งเพื่อยืนยัน
                            </p>
                        )}

                        {!isAllowed && (
                            <p className="text-xs text-red-500 dark:text-red-400 mb-4">
                                ไม่สามารถ{actionLabel}ได้ เนื่องจากอยู่นอกรัศมีที่กำหนด
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="px-6 pb-6 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            ปิด
                        </button>
                        {isAllowed && (
                            <button
                                onClick={handleConfirmClick}
                                disabled={loading}
                                className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-70 ${
                                    action === 'clock_in'
                                        ? 'bg-primary hover:bg-blue-600 shadow-primary/30'
                                        : clockOutConfirmed
                                            ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30 ring-2 ring-red-300 dark:ring-red-700'
                                            : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30'
                                }`}
                            >
                                {loading ? (
                                    <span className="material-icons-round animate-spin text-lg">autorenew</span>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-lg">
                                            {action === 'clock_in' ? 'fingerprint' : clockOutConfirmed ? 'check' : 'logout'}
                                        </span>
                                        {action === 'clock_out' && clockOutConfirmed ? 'ยืนยัน!' : actionLabel}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes locModalSlideUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default LocationCheckModal;
