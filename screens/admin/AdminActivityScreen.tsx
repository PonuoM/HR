import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { getActivitySettings, toggleActivity, setSystemStartDate, updateActivityLink, getEmployees, addActivityViewer, removeActivityViewer } from '../../services/api';

interface Activity {
    id: number;
    activity_key: string;
    enabled: boolean;
    label: string;
    description: string;
    icon: string;
    sort_order: number;
    start_date: string | null;
    external_url: string | null;
    audience: 'all' | 'admin';
    extra_viewers: string[];
}

interface EmpRef { id: string; name: string; nickname?: string; is_admin?: number }

const ACTIVITY_COLORS: Record<string, string> = {
    employee_vote: 'from-amber-400 to-orange-500',
    attendance_check: 'from-blue-400 to-indigo-500',
    asset_management: 'from-slate-500 to-slate-700',
    material_request: 'from-cyan-400 to-blue-500',
};

const ACTIVITY_EMOJIS: Record<string, string> = {
    employee_vote: '🏆',
    attendance_check: '⏰',
    asset_management: '📦',
    material_request: '🛒',
};

const AdminActivityScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const [startDateInput, setStartDateInput] = useState('');
    const [savingDate, setSavingDate] = useState(false);
    // Link-editor draft state — keyed by activity_key. Lets us edit URL +
    // audience inline without firing a save on every keystroke.
    const [linkDrafts, setLinkDrafts] = useState<Record<string, { url: string; audience: 'all' | 'admin' }>>({});
    const [savingLink, setSavingLink] = useState<string | null>(null);

    // Employee picker state — loaded once, opened per-activity from a modal
    const [allEmployees, setAllEmployees] = useState<EmpRef[]>([]);
    const [pickerForKey, setPickerForKey] = useState<string | null>(null);
    const [pickerSearch, setPickerSearch] = useState('');
    const [viewerBusy, setViewerBusy] = useState<string | null>(null); // `${key}:${empId}` while pending

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

    // Load employee directory once for the picker modal.
    useEffect(() => {
        getEmployees().then(setAllEmployees).catch(() => { });
    }, []);

    const handleAddViewer = async (key: string, empId: string) => {
        setViewerBusy(`${key}:${empId}`);
        try {
            await addActivityViewer(key, empId);
            setActivities(prev => prev.map(a =>
                a.activity_key === key
                    ? { ...a, extra_viewers: Array.from(new Set([...a.extra_viewers, empId])) }
                    : a
            ));
        } catch (e: any) {
            toast(e.message || 'เพิ่มไม่สำเร็จ', 'error');
        } finally {
            setViewerBusy(null);
        }
    };

    const handleRemoveViewer = async (key: string, empId: string) => {
        setViewerBusy(`${key}:${empId}`);
        try {
            await removeActivityViewer(key, empId);
            setActivities(prev => prev.map(a =>
                a.activity_key === key
                    ? { ...a, extra_viewers: a.extra_viewers.filter(id => id !== empId) }
                    : a
            ));
        } catch (e: any) {
            toast(e.message || 'ลบไม่สำเร็จ', 'error');
        } finally {
            setViewerBusy(null);
        }
    };

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

    // Hydrate link drafts from server data so the form mirrors the saved state.
    useEffect(() => {
        const drafts: Record<string, { url: string; audience: 'all' | 'admin' }> = {};
        activities.forEach(a => {
            if (a.external_url !== null && a.external_url !== undefined) {
                drafts[a.activity_key] = {
                    url: a.external_url || '',
                    audience: a.audience || 'all',
                };
            }
        });
        setLinkDrafts(drafts);
    }, [activities]);

    const handleSaveLink = async (key: string) => {
        const draft = linkDrafts[key];
        if (!draft) return;
        setSavingLink(key);
        try {
            await updateActivityLink({ key, external_url: draft.url, audience: draft.audience });
            setActivities(prev => prev.map(a =>
                a.activity_key === key
                    ? { ...a, external_url: draft.url, audience: draft.audience }
                    : a
            ));
            toast('บันทึกลิงก์แล้ว', 'success');
        } catch (e: any) {
            toast(e.message || 'บันทึกไม่สำเร็จ', 'error');
        } finally {
            setSavingLink(null);
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

                                    {/* Link editor — shown only for external-link activities */}
                                    {linkDrafts[act.activity_key] !== undefined && (
                                        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-2.5 bg-gray-50/50 dark:bg-gray-900/30 rounded-b-xl">
                                            <div>
                                                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 block mb-1">URL ปลายทาง</label>
                                                <input
                                                    type="url"
                                                    value={linkDrafts[act.activity_key].url}
                                                    onChange={(e) => setLinkDrafts(prev => ({
                                                        ...prev,
                                                        [act.activity_key]: { ...prev[act.activity_key], url: e.target.value },
                                                    }))}
                                                    placeholder="https://..."
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                                />
                                            </div>
                                            <div className="flex items-end gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 block mb-1">ใครเห็น Link นี้ได้</label>
                                                    <select
                                                        value={linkDrafts[act.activity_key].audience}
                                                        onChange={(e) => setLinkDrafts(prev => ({
                                                            ...prev,
                                                            [act.activity_key]: { ...prev[act.activity_key], audience: e.target.value as 'all' | 'admin' },
                                                        }))}
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                                    >
                                                        <option value="all">พนักงานทุกคน</option>
                                                        <option value="admin">เฉพาะ Admin</option>
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={() => handleSaveLink(act.activity_key)}
                                                    disabled={savingLink === act.activity_key
                                                        || (linkDrafts[act.activity_key].url === (act.external_url || '')
                                                            && linkDrafts[act.activity_key].audience === act.audience)}
                                                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-1"
                                                >
                                                    {savingLink === act.activity_key ? (
                                                        <span className="material-icons-round animate-spin text-sm">autorenew</span>
                                                    ) : (
                                                        <span className="material-icons-round text-sm">save</span>
                                                    )}
                                                    บันทึก
                                                </button>
                                            </div>

                                            {/* Extra viewers — only meaningful when audience is 'admin' */}
                                            {act.audience === 'admin' && (
                                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                                                            ผู้ดูเพิ่มนอกเหนือ Admin
                                                            {act.extra_viewers.length > 0 && (
                                                                <span className="ml-1.5 text-gray-400">({act.extra_viewers.length})</span>
                                                            )}
                                                        </label>
                                                        <button
                                                            onClick={() => { setPickerForKey(act.activity_key); setPickerSearch(''); }}
                                                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                                                        >
                                                            <span className="material-icons-round text-sm">person_add</span>
                                                            เพิ่มผู้ดู
                                                        </button>
                                                    </div>
                                                    {act.extra_viewers.length === 0 ? (
                                                        <p className="text-[11px] text-gray-400 italic">ยังไม่มี — admin เห็นได้ทุกคนอยู่แล้ว</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {act.extra_viewers.map(empId => {
                                                                const e = allEmployees.find(x => x.id === empId);
                                                                const busy = viewerBusy === `${act.activity_key}:${empId}`;
                                                                return (
                                                                    <span key={empId}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 text-xs text-cyan-700 dark:text-cyan-300">
                                                                        <span>{e?.nickname || e?.name || empId}</span>
                                                                        <button
                                                                            onClick={() => handleRemoveViewer(act.activity_key, empId)}
                                                                            disabled={busy}
                                                                            className="hover:text-red-500 disabled:opacity-50"
                                                                            title="ลบ"
                                                                        >
                                                                            <span className="material-icons-round text-sm">{busy ? 'autorenew' : 'close'}</span>
                                                                        </button>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
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

            {/* ───────── Employee picker modal ───────── */}
            {pickerForKey && (() => {
                const act = activities.find(a => a.activity_key === pickerForKey);
                if (!act) return null;
                const search = pickerSearch.trim().toLowerCase();
                // Hide admins (already see the link) and already-added viewers
                const candidates = allEmployees
                    .filter(e => !e.is_admin)
                    .filter(e => !act.extra_viewers.includes(e.id))
                    .filter(e => !search
                        || e.name.toLowerCase().includes(search)
                        || (e.nickname || '').toLowerCase().includes(search)
                        || e.id.toLowerCase().includes(search));

                return (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setPickerForKey(null)}>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">เพิ่มผู้ดู</h3>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{act.label}</p>
                                </div>
                                <button onClick={() => setPickerForKey(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="material-icons-round text-gray-500">close</span>
                                </button>
                            </div>
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                <div className="relative">
                                    <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัส"
                                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {candidates.length === 0 ? (
                                    <p className="text-center text-sm text-gray-400 py-12">
                                        {search ? 'ไม่พบพนักงาน' : 'ไม่มีพนักงานที่เพิ่มได้'}
                                    </p>
                                ) : (
                                    candidates.map(e => {
                                        const busy = viewerBusy === `${pickerForKey}:${e.id}`;
                                        return (
                                            <button
                                                key={e.id}
                                                onClick={() => handleAddViewer(pickerForKey, e.id)}
                                                disabled={busy}
                                                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0 disabled:opacity-50"
                                            >
                                                <div className="flex items-center gap-3 text-left">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                        {(e.nickname || e.name).slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                            {e.name} {e.nickname && <span className="text-gray-500 font-normal">({e.nickname})</span>}
                                                        </p>
                                                        <p className="text-[11px] text-gray-400">{e.id}</p>
                                                    </div>
                                                </div>
                                                <span className="material-icons-round text-primary text-xl">
                                                    {busy ? 'autorenew' : 'add_circle'}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
                                <button onClick={() => setPickerForKey(null)}
                                    className="w-full py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
                                    เสร็จสิ้น
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default AdminActivityScreen;
