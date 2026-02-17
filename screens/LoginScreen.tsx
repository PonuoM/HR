import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

const LoginScreen: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { toast } = useToast();
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);

    // Restore saved credentials
    useEffect(() => {
        try {
            const saved = localStorage.getItem('hr_remember');
            if (saved) {
                const { employeeId: sId, password: sPw } = JSON.parse(saved);
                setEmployeeId(sId || '');
                setPassword(sPw || '');
                setRememberMe(true);
            }
        } catch { /* ignore */ }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId.trim() || !password.trim()) {
            toast('กรุณากรอกข้อมูลให้ครบ', 'warning');
            return;
        }
        setLoading(true);
        try {
            const result = await login(employeeId.trim(), password);
            // Save or clear remembered credentials
            if (rememberMe) {
                localStorage.setItem('hr_remember', JSON.stringify({ employeeId: employeeId.trim(), password }));
            } else {
                localStorage.removeItem('hr_remember');
            }
            // Show device warning if applicable
            if (result?.device_warning) {
                toast(`⚠️ ${result.device_warning}`, 'warning');
            }
            toast('เข้าสู่ระบบสำเร็จ', 'success');
            navigate('/', { replace: true });
        } catch (err: any) {
            toast(err.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-700" />
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
            </div>

            {/* Content */}
            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row items-center md:items-stretch gap-8 md:gap-0">

                    {/* LEFT SIDE — Branding (Desktop only) */}
                    <div className="hidden md:flex flex-col justify-center flex-1 pr-12 text-white">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                <span className="text-3xl font-black text-white">HR</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">HR Connect</h1>
                                <p className="text-blue-200 text-sm">Mobile</p>
                            </div>
                        </div>
                        <h2 className="text-4xl font-extrabold leading-tight mb-4">
                            ระบบจัดการ<br />ทรัพยากรบุคคล
                        </h2>
                        <p className="text-blue-100 text-lg leading-relaxed max-w-md">
                            จัดการข้อมูลพนักงาน ลงเวลา ยื่นคำขอลา และดูสลิปเงินเดือนได้ทุกที่ทุกเวลา
                        </p>
                        <div className="mt-8 flex items-center gap-6">
                            <div className="flex items-center gap-2 text-blue-200">
                                <span className="material-icons-round text-lg">verified_user</span>
                                <span className="text-sm">ปลอดภัย</span>
                            </div>
                            <div className="flex items-center gap-2 text-blue-200">
                                <span className="material-icons-round text-lg">speed</span>
                                <span className="text-sm">รวดเร็ว</span>
                            </div>
                            <div className="flex items-center gap-2 text-blue-200">
                                <span className="material-icons-round text-lg">devices</span>
                                <span className="text-sm">ทุกอุปกรณ์</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE — Login Card */}
                    <div className="w-full max-w-sm md:max-w-md">
                        {/* Mobile Logo */}
                        <div className="md:hidden text-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 shadow-lg">
                                <span className="text-3xl font-black text-white">HR</span>
                            </div>
                            <h1 className="text-xl font-bold text-white">HR Connect</h1>
                            <p className="text-blue-200 text-sm">เข้าสู่ระบบเพื่อใช้งาน</p>
                        </div>

                        {/* Card */}
                        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 md:p-8">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 hidden md:block">เข้าสู่ระบบ</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 hidden md:block">กรอกข้อมูลเพื่อเข้าใช้งาน</p>

                                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" data-lpignore="true" data-form-type="other">
                                    {/* Employee ID */}
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                                            รหัสพนักงาน
                                        </label>
                                        <div className="relative">
                                            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">badge</span>
                                            <input
                                                type="text"
                                                value={employeeId}
                                                onChange={e => setEmployeeId(e.target.value.toUpperCase())}
                                                placeholder="เช่น EMP001"
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all dark:text-white"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                                            รหัสผ่าน
                                        </label>
                                        <div className="relative">
                                            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
                                            <input
                                                type="text"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                placeholder="กรอกรหัสผ่าน"
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all dark:text-white"
                                                style={showPassword ? {} : { WebkitTextSecurity: 'disc', textSecurity: 'disc' } as React.CSSProperties}
                                                autoComplete="off"
                                                data-lpignore="true"
                                                data-form-type="other"
                                                name="pin"
                                                id="pin-input"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                            >
                                                <span className="material-icons-round text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Remember Me */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRememberMe(!rememberMe)}
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${rememberMe
                                                ? 'bg-blue-500 border-blue-500'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                                }`}
                                        >
                                            {rememberMe && (
                                                <span className="material-icons-round text-white text-sm">check</span>
                                            )}
                                        </button>
                                        <span
                                            onClick={() => setRememberMe(!rememberMe)}
                                            className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none"
                                        >
                                            จำรหัสผ่าน
                                        </span>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                กำลังเข้าสู่ระบบ...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons-round text-lg">login</span>
                                                เข้าสู่ระบบ
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>

                            {/* Footer */}
                            <div className="px-6 md:px-8 pb-6 pt-2">
                                <div className="text-center">
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        หากลืมรหัสผ่าน กรุณาติดต่อ HR
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Footer */}
                        <div className="md:hidden text-center mt-6">
                            <p className="text-blue-200 text-xs">© 2026 HR Connect. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Footer */}
            <div className="hidden md:block absolute bottom-4 left-0 right-0 text-center">
                <p className="text-blue-200/60 text-xs">© 2026 HR Connect. All rights reserved.</p>
            </div>
        </div>
    );
};

export default LoginScreen;
