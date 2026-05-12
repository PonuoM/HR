import React, { useMemo } from 'react';

/**
 * Reusable weekly-schedule editor.
 *
 * Schema (matches backend api/schedule_helper.php):
 * {
 *   "1": { active, in, out, lunch_min, weeks? },  // Mon
 *   ...
 *   "7": { active, in, out, lunch_min, weeks? },  // Sun
 * }
 * weeks: 'all' (default) | 'odd' | 'even' — for เสาร์เว้นเสาร์
 */

export interface ScheduleDay {
    active: boolean;
    in?: string;       // "HH:MM"
    out?: string;      // "HH:MM"
    lunch_min?: number; // minutes (default 60)
    weeks?: 'all' | 'odd' | 'even';
}

export type ScheduleJson = Record<string, ScheduleDay>;

export const defaultWeeklySchedule = (workIn = '09:00', workOut = '17:00', lunch = 60): ScheduleJson => ({
    '1': { active: true, in: workIn, out: workOut, lunch_min: lunch },
    '2': { active: true, in: workIn, out: workOut, lunch_min: lunch },
    '3': { active: true, in: workIn, out: workOut, lunch_min: lunch },
    '4': { active: true, in: workIn, out: workOut, lunch_min: lunch },
    '5': { active: true, in: workIn, out: workOut, lunch_min: lunch },
    '6': { active: false },
    '7': { active: false },
});

export const parseScheduleJson = (raw: string | null | undefined): ScheduleJson | null => {
    if (!raw) return null;
    try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!obj || typeof obj !== 'object') return null;
        return obj as ScheduleJson;
    } catch { return null; }
};

const DOW_LABELS: { key: string; label: string; short: string }[] = [
    { key: '1', label: 'จันทร์', short: 'จ.' },
    { key: '2', label: 'อังคาร', short: 'อ.' },
    { key: '3', label: 'พุธ', short: 'พ.' },
    { key: '4', label: 'พฤหัสบดี', short: 'พฤ.' },
    { key: '5', label: 'ศุกร์', short: 'ศ.' },
    { key: '6', label: 'เสาร์', short: 'ส.' },
    { key: '7', label: 'อาทิตย์', short: 'อา.' },
];

interface Props {
    value: ScheduleJson | null;
    onChange: (next: ScheduleJson | null) => void;
    /** When true, shows a “use default” checkbox that sets value to null. */
    allowOverride?: boolean;
    /** Called once if user toggles "use default" off (i.e. wants to override). */
    defaultIfEnabled?: ScheduleJson;
    /** Optional: shown when value is null (override disabled). */
    fallbackHint?: string;
}

const ScheduleEditor: React.FC<Props> = ({ value, onChange, allowOverride = false, defaultIfEnabled, fallbackHint }) => {
    const overrideEnabled = value !== null;

    const sched = useMemo<ScheduleJson>(() => value ?? defaultWeeklySchedule(), [value]);

    const updateDay = (dayKey: string, patch: Partial<ScheduleDay>) => {
        const next: ScheduleJson = { ...sched, [dayKey]: { ...sched[dayKey], ...patch } };
        onChange(next);
    };

    const handleToggleOverride = (checked: boolean) => {
        if (checked) {
            onChange(defaultIfEnabled || defaultWeeklySchedule());
        } else {
            onChange(null);
        }
    };

    return (
        <div className="space-y-3">
            {allowOverride && (
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                    <div>
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">กำหนดเวลาทำงานเฉพาะคนนี้</div>
                        <div className="text-[11px] text-amber-600/80 dark:text-amber-400/70">
                            {overrideEnabled ? 'ใช้ตารางเวลานี้แทน schedule ของแผนก' : (fallbackHint || 'ใช้ตารางเวลาตามแผนก')}
                        </div>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={overrideEnabled} onChange={e => handleToggleOverride(e.target.checked)} className="sr-only peer" />
                        <div className="relative w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-checked:bg-amber-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></div>
                    </label>
                </div>
            )}

            {(!allowOverride || overrideEnabled) && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                    {DOW_LABELS.map(({ key, label }) => {
                        const day = sched[key] || { active: false };
                        return (
                            <div key={key} className={`px-3 py-2.5 ${day.active ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/40'}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Active toggle */}
                                    <label className="inline-flex items-center gap-2 min-w-[110px]">
                                        <input type="checkbox" checked={!!day.active} onChange={e => updateDay(key, { active: e.target.checked, in: day.in || '09:00', out: day.out || '17:00', lunch_min: day.lunch_min ?? 60 })}
                                            className="w-4 h-4 accent-primary" />
                                        <span className={`text-sm font-semibold ${day.active ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
                                    </label>

                                    {day.active ? (
                                        <>
                                            <input type="time" value={day.in || '09:00'} onChange={e => updateDay(key, { in: e.target.value })}
                                                className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                                            <span className="text-gray-400 text-xs">—</span>
                                            <input type="time" value={day.out || '17:00'} onChange={e => updateDay(key, { out: e.target.value })}
                                                className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />

                                            <label className="inline-flex items-center gap-1 ml-auto text-[11px] text-gray-500">
                                                lunch:
                                                <select value={day.lunch_min ?? 60} onChange={e => updateDay(key, { lunch_min: parseInt(e.target.value) })}
                                                    className="px-1.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white">
                                                    <option value={0}>0 นาที</option>
                                                    <option value={30}>30 นาที</option>
                                                    <option value={45}>45 นาที</option>
                                                    <option value={60}>60 นาที</option>
                                                    <option value={90}>90 นาที</option>
                                                </select>
                                            </label>

                                            {/* Alternating-week selector — typically used for เสาร์เว้นเสาร์ */}
                                            {(key === '6' || key === '7') && (
                                                <label className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                                    สัปดาห์:
                                                    <select value={day.weeks || 'all'} onChange={e => updateDay(key, { weeks: e.target.value as ScheduleDay['weeks'] })}
                                                        className="px-1.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white">
                                                        <option value="all">ทุกสัปดาห์</option>
                                                        <option value="odd">สัปดาห์คี่</option>
                                                        <option value="even">สัปดาห์คู่</option>
                                                    </select>
                                                </label>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">วันหยุด</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {(!allowOverride || overrideEnabled) && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 px-1">
                    💡 lunch หักออกจากเวลาทำงานอัตโนมัติ (default 60 นาที, อยู่ราว 12:00-13:00) •
                    "สัปดาห์คี่/คู่" ใช้สำหรับ <b>เสาร์เว้นเสาร์</b>
                </div>
            )}
        </div>
    );
};

export default ScheduleEditor;
