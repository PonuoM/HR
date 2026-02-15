import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        // Don't show if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        if (isStandalone) return;

        // Check if dismissed recently (7 days)
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

        // Detect iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIOSDevice);

        if (isIOSDevice) {
            // Show banner after 2 seconds on iOS
            const timer = setTimeout(() => setShowBanner(true), 2000);
            return () => clearTimeout(timer);
        }

        // Android/Chrome: Listen for beforeinstallprompt
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setTimeout(() => setShowBanner(true), 1500);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (isIOS) {
            setShowIOSGuide(true);
            return;
        }
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setShowBanner(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        setShowIOSGuide(false);
        localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    };

    if (!showBanner) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/40 z-[9998] md:hidden" onClick={handleDismiss} />

            {/* Install Banner — mobile only */}
            <div className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden" style={{ animation: 'installSlideUp 0.35s ease-out' }}>
                <div className="mx-3 mb-3 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">

                    {!showIOSGuide ? (
                        /* Main Install Card */
                        <div className="p-5">
                            <div className="flex items-center gap-4 mb-4">
                                <img src="/icons/icon-512.png" alt="HR Connect" className="w-14 h-14 rounded-2xl shadow-md" />
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 dark:text-white text-base">HR Connect</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Primapassion49</p>
                                </div>
                                <button onClick={handleDismiss} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
                                    <span className="material-icons-round text-xl">close</span>
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                                ติดตั้งแอป HR Connect บนหน้าจอหลัก เพื่อเข้าใช้งานได้เร็วขึ้น และรับการแจ้งเตือน
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDismiss}
                                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    ไว้ทีหลัง
                                </button>
                                <button
                                    onClick={handleInstall}
                                    className="flex-1 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-md"
                                >
                                    <span className="material-icons-round text-lg">install_mobile</span>
                                    ติดตั้งแอป
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* iOS Step-by-Step Guide */
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-gray-900 dark:text-white text-base">วิธีติดตั้งบน iPhone</h3>
                                <button onClick={handleDismiss} className="p-1 text-gray-400 hover:text-gray-600">
                                    <span className="material-icons-round text-xl">close</span>
                                </button>
                            </div>
                            <div className="space-y-4">
                                {/* Step 1 */}
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-primary">1</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            กดปุ่ม <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                                                <span className="material-icons-round text-sm text-primary mr-0.5">ios_share</span> แชร์
                                            </span> ที่ด้านล่าง Safari
                                        </p>
                                    </div>
                                </div>
                                {/* Step 2 */}
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-primary">2</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            เลื่อนลง แตะ <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                                                <span className="material-icons-round text-sm text-primary mr-0.5">add_box</span> เพิ่มไปยังหน้าจอหลัก
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                {/* Step 3 */}
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                        <span className="material-icons-round text-sm text-green-600">check</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            กด <strong>"เพิ่ม"</strong> — เสร็จเรียบร้อย! 🎉
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Animation */}
            <style>{`
                @keyframes installSlideUp {
                    from { opacity: 0; transform: translateY(100%); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default InstallPrompt;
