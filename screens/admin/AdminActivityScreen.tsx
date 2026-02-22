import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { getActivitySettings, toggleActivity, setSystemStartDate } from '../../services/api';

interface Activity {
    id: number;
    activity_key: string;
    enabled: boolean;
    label: string;
    description: string;
    icon: string;
    sort_order: number;
    start_date: string | null;
}

const ACTIVITY_COLORS: Record<string, string> = {
    employee_vote: 'from-amber-400 to-orange-500',
    attendance_check: 'from-blue-400 to-indigo-500',
};

const ACTIVITY_EMOJIS: Record<string, string> = {
    employee_vote: '🏆',
    attendance_check: '⏰',
};

const AdminActivityScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const [startDateInput, setStartDateInput] = useState('');
    const [savingDate, setSavingDate] = useState(false);

    const loadActivities = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getActivitySettings();
            setActivities(data);
        } catch (e: any) {
            toast(e.message || 'โหลดข้อมูลไม่สำเร็จ', 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { loadActivities(); }, [loadActivities]);

    // Load start_date from activities
    useEffect(() => {
        const first = activities.find(a => a.start_date);
        if (first?.start_date) setStartDateInput(first.start_date);
    }, [activities]);

    const handleSetStartDate = async () => {
        if (!startDateInput) return;
        setSavingDate(true);
        try {
            await setSystemStartDate(startDateInput);
            await loadActivities();
            toast('บันทึกวันเริ่มใช้ระบบแล้ว', 'success');
        } catch (e: any) {
            toast(e.message || 'บันทึกไม่สำเร็จ', 'error');
        } finally {
            setSavingDate(false);
        }
    };

    const handleToggle = async (key: string, currentEnabled: boolean) => {
        setToggling(key);
        try {
            await toggleActivity(key, !currentEnabled);
            setActivities(prev =>
                prev.map(a => a.activity_key === key ? { ...a, enabled: !currentEnabled } : a)
            );
            toast(`${currentEnabled ? 'ปิด' : 'เปิด'}กิจกรรมแล้ว`, 'success');
        } catch (e: any) {
            toast(e.message || 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
        } finally {
            setToggling(null);
        }
    };

    return (
        <div className="pt-14 md:pt-6 pb-24 md:pb-8 min-h-screen bg-gray-50 dark:bg-gray-950">

            {/* Header */}
            <header className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3 md:relative md:border-none md:bg-transparent md:dark:bg-transparent">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="md:hidden w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <span className="material-icons-round text-lg">arrow_back</span>
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200/50 dark:shadow-violet-900/30">
                        <span className="material-icons-round text-white text-xl">extension</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white">ตั้งค่ากิจกรรม</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">เปิด-ปิดฟีเจอร์ต่างๆ ของระบบ</p>
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 pt-4">

                {/* System Start Date */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                            <span className="text-lg">📅</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">วันเริ่มใช้ระบบ</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">ระบบจะเริ่มนับและตรวจสอบตั้งแต่วันนี้เป็นต้นไป</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDateInput}
                            onChange={(e) => setStartDateInput(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        />
                        <button
                            onClick={handleSetStartDate}
                            disabled={savingDate || !startDateInput}
                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1"
                        >
                            {savingDate ? (
                                <span className="material-icons-round animate-spin text-sm">autorenew</span>
                            ) : (
                                <span className="material-icons-round text-sm">save</span>
                            )}
                            บันทึก
                        </button>
                    </div>
                    {startDateInput && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                            <span className="material-icons-round text-xs">check_circle</span>
                            เริ่มใช้ระบบตั้งแต่: {new Date(startDateInput + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    )}
                </div>

                {/* Info Banner */}
                <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl px-4 py-3 mb-4">
                    <span className="material-icons-round text-blue-500 text-lg mt-0.5">info</span>
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        เปิดหรือปิดกิจกรรมให้พนักงานเห็นบนแอป เมื่อปิดกิจกรรม เมนูและหน้าจอที่เกี่ยวข้องจะไม่แสดงให้พนักงานเห็น
                    </p>
                </div>

                {/* Activity List */}
                {loading ? (
                    <div className="text-center py-16">
                        <span className="material-icons-round animate-spin text-3xl text-blue-500">autorenew</span>
                        <p className="text-sm text-gray-400 mt-3">กำลังโหลด...</p>
                    </div>
                ) : activities.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 block mb-2">extension_off</span>
                        <p className="text-gray-500 font-medium">ยังไม่มีกิจกรรมในระบบ</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activities.map(act => {
                            const isToggling = toggling === act.activity_key;
                            const gradient = ACTIVITY_COLORS[act.activity_key] || 'from-gray-400 to-gray-500';
                            const emoji = ACTIVITY_EMOJIS[act.activity_key] || '🎯';

                            return (
                                <div
                                    key={act.id}
                                    className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm transition-all ${act.enabled
                                        ? 'border-gray-100 dark:border-gray-700'
                                        : 'border-gray-100 dark:border-gray-700 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 px-4 py-4">
                                        {/* Icon */}
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                                            <span className="text-2xl">{emoji}</span>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{act.label}</p>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${act.enabled
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                                    }`}>
                                                    {act.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{act.description}</p>
                                            {act.start_date && (
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-0.5">
                                                    <span className="material-icons-round" style={{ fontSize: '11px' }}>calendar_today</span>
                                                    เริ่ม: {new Date(act.start_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            )}
                                        </div>

                                        {/* Toggle Switch */}
                                        <button
                                            onClick={() => handleToggle(act.activity_key, act.enabled)}
                                            disabled={isToggling}
                                            className={`relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0 ${act.enabled
                                                ? 'bg-green-500'
                                                : 'bg-gray-300 dark:bg-gray-600'
                                                } ${isToggling ? 'opacity-50' : ''}`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${act.enabled ? 'left-[22px]' : 'left-0.5'
                                                }`}>
                                                {isToggling && (
                                                    <span className="material-icons-round animate-spin text-xs text-gray-400 absolute inset-0 flex items-center justify-center">autorenew</span>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Future Activities Hint */}
                <div className="mt-6 text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <span className="material-icons-round text-3xl text-gray-300 dark:text-gray-600 block mb-2">add_circle_outline</span>
                    <p className="text-xs text-gray-400">กิจกรรมใหม่จะปรากฏที่นี่เมื่อมีการเพิ่มในระบบ</p>
                </div>
            </div>
        </div>
    );
};

export default AdminActivityScreen;
