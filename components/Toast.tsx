import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Inline keyframes for animations
const toastStyles = `
@keyframes toast-slide-down { from { opacity: 0; transform: translateY(-16px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes toast-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes toast-scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
`;
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------- Hook ----------
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}

// ---------- Icons ----------
const icons: Record<ToastType, { icon: string; bg: string; ring: string }> = {
    success: { icon: 'check_circle', bg: 'bg-green-500', ring: 'ring-green-500/20' },
    error: { icon: 'error', bg: 'bg-red-500', ring: 'ring-red-500/20' },
    warning: { icon: 'warning', bg: 'bg-orange-500', ring: 'ring-orange-500/20' },
    info: { icon: 'info', bg: 'bg-blue-500', ring: 'ring-blue-500/20' },
};

// ---------- Provider ----------
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);

    // Confirm dialog state
    const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

    const toast = useCallback((message: string, type: ToastType = 'success') => {
        const id = nextId.current++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setConfirmState({ ...options, resolve });
        });
    }, []);

    const handleConfirm = (value: boolean) => {
        confirmState?.resolve(value);
        setConfirmState(null);
    };

    const confirmColors = {
        danger: { btn: 'bg-red-500 hover:bg-red-600 shadow-red-500/30', icon: 'block', iconBg: 'bg-red-100 dark:bg-red-900/20 text-red-500' },
        warning: { btn: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30', icon: 'warning', iconBg: 'bg-orange-100 dark:bg-orange-900/20 text-orange-500' },
        info: { btn: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30', icon: 'help', iconBg: 'bg-blue-100 dark:bg-blue-900/20 text-blue-500' },
    };

    return (
        <ToastContext.Provider value={{ toast, confirm }}>
            {children}

            {/* Inject animation styles */}
            <style>{toastStyles}</style>

            {/* ---- Toast Stack ---- */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-[90vw] max-w-md">
                {toasts.map(t => {
                    const s = icons[t.type];
                    return (
                        <div
                            key={t.id}
                            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 shadow-xl ring-1 ${s.ring}`}
                            style={{ animation: 'toast-slide-down 0.3s ease-out' }}
                        >
                            <div className={`w-8 h-8 rounded-full ${s.bg} flex items-center justify-center flex-shrink-0`}>
                                <span className="material-icons-round text-white text-lg">{s.icon}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{t.message}</p>
                        </div>
                    );
                })}
            </div>

            {/* ---- Confirm Dialog ---- */}
            {confirmState && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ animation: 'toast-fade-in 0.2s ease-out' }}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ animation: 'toast-scale-in 0.2s ease-out' }}>
                        <div className="p-6 text-center">
                            <div className={`w-14 h-14 rounded-full ${confirmColors[confirmState.type || 'info'].iconBg} mx-auto mb-4 flex items-center justify-center`}>
                                <span className="material-icons-round text-3xl">{confirmColors[confirmState.type || 'info'].icon}</span>
                            </div>
                            {confirmState.title && <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{confirmState.title}</h3>}
                            <p className="text-sm text-gray-600 dark:text-gray-400">{confirmState.message}</p>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => handleConfirm(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                {confirmState.cancelText || 'ยกเลิก'}
                            </button>
                            <button
                                onClick={() => handleConfirm(true)}
                                className={`flex-1 py-3 rounded-xl text-white font-semibold shadow-lg transition-colors ${confirmColors[confirmState.type || 'info'].btn}`}
                            >
                                {confirmState.confirmText || 'ยืนยัน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
};
