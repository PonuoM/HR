import React, { useRef } from 'react';
import { API_BASE } from '../services/api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { PROFILE_MENU_ITEMS, PROFILE_ADMIN_ITEMS } from '../data';
import { useApi } from '../hooks/useApi';
import { getEmployee } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

const ProfileScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user: authUser, logout, updateUser } = useAuth();
    const { toast, confirm: showConfirm } = useToast();
    const { data: user, loading, refetch } = useApi(() => getEmployee(authUser?.id || ''), [authUser?.id]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate
        if (!file.type.startsWith('image/')) {
            toast('กรุณาเลือกไฟล์รูปภาพ', 'warning');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast('ไฟล์ใหญ่เกิน 5MB', 'warning');
            return;
        }

        try {
            // Upload file
            const formData = new FormData();
            formData.append('file', file);
            formData.append('category', 'avatar');
            formData.append('related_id', authUser?.id || '');
            formData.append('uploaded_by', authUser?.id || '');

            const uploadRes = await fetch(`${API_BASE}/uploads.php`, { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) throw new Error(uploadData.error || 'อัปโหลดไม่สำเร็จ');

            // Update employee avatar
            const updateRes = await fetch(`${API_BASE}/employees.php?id=${authUser?.id || ''}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: uploadData.url }),
            });

            if (!updateRes.ok) throw new Error('อัปเดตรูปไม่สำเร็จ');

            toast('เปลี่ยนรูปโปรไฟล์เรียบร้อย', 'success');
            updateUser({ avatar: uploadData.url });
            refetch();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark pb-24 md:pb-0">
            {/* Header Profile */}
            <div className="bg-white dark:bg-gray-800 pt-8 pb-8 px-6 rounded-b-[2rem] shadow-sm border-b border-gray-100 dark:border-gray-700">
                {loading ? (
                    <div className="text-center py-8 text-gray-400"><span className="material-icons-round animate-spin">autorenew</span></div>
                ) : user && (
                    <div className="flex flex-col items-center">
                        <div className="relative">
                            <img
                                src={user.avatar || 'https://picsum.photos/id/64/200/200'}
                                alt="Profile"
                                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-700 shadow-lg object-cover"
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-md border-2 border-white dark:border-gray-700 hover:bg-primary-hover transition-colors"
                            >
                                <span className="material-icons-round text-sm block">camera_alt</span>
                            </button>
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.position} • {user.department}</p>
                        <div className="mt-3 px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold">
                            {user.employment_type || 'พนักงานประจำ'}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-6 py-6 space-y-6">

                {/* Admin Section (Mobile Only Access Point) */}
                {user?.is_admin == 1 && (
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 ml-1">
                            ผู้ดูแลระบบ (Admin)
                        </h3>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                            {PROFILE_ADMIN_ITEMS.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => navigate(item.path)}
                                    className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors text-left"
                                >
                                    <div className={`w-10 h-10 rounded-lg ${item.color} dark:bg-opacity-20 flex items-center justify-center`}>
                                        <span className="material-icons-round text-xl">{item.icon}</span>
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-semibold text-gray-900 dark:text-white text-sm block">{item.label}</span>
                                    </div>
                                    <span className="material-icons-round text-gray-400">chevron_right</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* General Settings */}
                <section>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 ml-1">
                        เมนูทั่วไป
                    </h3>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                        {PROFILE_MENU_ITEMS.map((item, index) => (
                            <button
                                key={index}
                                onClick={() => navigate(item.path)}
                                className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors text-left"
                            >
                                <div className={`w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 flex items-center justify-center`}>
                                    <span className="material-icons-round text-xl">{item.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm block">{item.label}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</span>
                                </div>
                                <span className="material-icons-round text-gray-400">chevron_right</span>
                            </button>
                        ))}
                    </div>
                </section>

                <button
                    onClick={async () => {
                        if (await showConfirm({ message: 'ต้องการออกจากระบบ?', type: 'warning', confirmText: 'ออกจากระบบ' })) {
                            logout();
                            navigate('/login', { replace: true });
                        }
                    }}
                    className="w-full py-4 text-red-500 font-semibold text-sm bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2"
                >
                    <span className="material-icons-round text-lg">logout</span>
                    ออกจากระบบ
                </button>
            </div>

            <BottomNav />
        </div>
    );
};

export default ProfileScreen;