import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCalendarData } from '../services/api';

// ─── Types ───
interface HolidayItem { date: string; name: string }
interface AttendanceItem { date: string; clock_in: string; clock_out: string | null; location: string }
interface LeaveItem { date: string; leave_type: string; color: string; status: string }
interface PartialItem { date: string; issue: 'no_clock_in' | 'no_clock_out' }
interface DayInfo {
    day: number;
    date: string;
    isToday: boolean;
    isCurrentMonth: boolean;
    isWeekend: boolean;
    isFuture: boolean;
    holidays: HolidayItem[];
    attendance: AttendanceItem | null;
    leaves: LeaveItem[];
    isMissed: boolean;
    partial: PartialItem | null;
}

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const CalendarScreen: React.FC = () => {
    const { user } = useAuth();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth()); // 0-indexed
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [holidays, setHolidays] = useState<HolidayItem[]>([]);
    const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
    const [leaves, setLeaves] = useState<LeaveItem[]>([]);
    const [missed, setMissed] = useState<string[]>([]);
    const [partial, setPartial] = useState<PartialItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const data = await getCalendarData(user?.id || 'EMP001', year, month + 1);
                if (!cancelled) {
                    setHolidays(data.holidays || []);
                    setAttendance(data.attendance || []);
                    setLeaves(data.leaves || []);
                    setMissed((data as any).missed || []);
                    setPartial((data as any).partial || []);
                }
            } catch { /* ignore */ }
            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [year, month, user?.id]);

    // Build calendar grid
    const calendarDays = useMemo<DayInfo[]>(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDow = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days: DayInfo[] = [];

        // Previous month fill
        const prevLast = new Date(year, month, 0).getDate();
        for (let i = startDow - 1; i >= 0; i--) {
            const d = prevLast - i;
            const m = month === 0 ? 12 : month;
            const y = month === 0 ? year - 1 : year;
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            days.push({ day: d, date: dateStr, isToday: false, isCurrentMonth: false, isWeekend: false, isFuture: false, holidays: [], attendance: null, leaves: [], isMissed: false, partial: null });
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dow = new Date(year, month, d).getDay();
            days.push({
                day: d,
                date: dateStr,
                isToday: dateStr === todayStr,
                isCurrentMonth: true,
                isWeekend: dow === 0 || dow === 6,
                isFuture: dateStr > todayStr,
                holidays: holidays.filter(h => h.date === dateStr),
                attendance: attendance.find(a => a.date === dateStr) || null,
                leaves: leaves.filter(l => l.date === dateStr),
                isMissed: missed.includes(dateStr),
                partial: partial.find(p => p.date === dateStr) || null,
            });
        }

        // Next month fill to 42
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            const m = month === 11 ? 1 : month + 2;
            const y = month === 11 ? year + 1 : year;
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            days.push({ day: d, date: dateStr, isToday: false, isCurrentMonth: false, isWeekend: false, isFuture: false, holidays: [], attendance: null, leaves: [], isMissed: false, partial: null });
        }

        return days;
    }, [year, month, holidays, attendance, leaves, missed, partial]);

    const selectedDayInfo = useMemo(() => {
        if (!selectedDate) return null;
        return calendarDays.find(d => d.date === selectedDate && d.isCurrentMonth) || null;
    }, [selectedDate, calendarDays]);

    // Monthly summary
    const summary = useMemo(() => {
        const currentDays = calendarDays.filter(d => d.isCurrentMonth);
        return {
            workDays: currentDays.filter(d => d.attendance && d.attendance.clock_in).length,
            holidays: currentDays.filter(d => d.holidays.length > 0).length,
            leaveDays: currentDays.filter(d => d.leaves.length > 0).length,
            missed: currentDays.filter(d => d.isMissed).length,
            partial: currentDays.filter(d => d.partial).length,
        };
    }, [calendarDays]);

    const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDate(null); };
    const goPrev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const goNext = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    // ─── Dot helper ───
    const getDots = (day: DayInfo, isSelected: boolean) => {
        const dots: { className: string }[] = [];
        const w = isSelected ? 'bg-white/80' : '';
        if (day.holidays.length > 0) dots.push({ className: w || 'bg-red-400' });
        if (day.attendance && day.attendance.clock_in) dots.push({ className: w || 'bg-emerald-400' });
        if (day.leaves.length > 0) dots.push({ className: w || 'bg-violet-400' });
        if (day.isMissed) dots.push({ className: w || 'bg-amber-400' });
        if (day.partial) dots.push({ className: w || 'bg-orange-400' });
        return dots.slice(0, 4);
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-4">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">ปฏิทิน</h1>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">วันหยุด · วันทำงาน · วันลา</p>
                    </div>
                    <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
                        วันนี้
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pt-4">
                <div className="flex flex-col lg:flex-row gap-4">

                    {/* ──── Calendar Card ──── */}
                    <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between px-5 py-4">
                            <button onClick={goPrev} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                                <span className="material-icons-round text-lg">chevron_left</span>
                            </button>
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                {THAI_MONTHS[month]} {year + 543}
                            </h2>
                            <button onClick={goNext} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                                <span className="material-icons-round text-lg">chevron_right</span>
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 px-3">
                            {THAI_DAYS_SHORT.map((d, i) => (
                                <div key={d} className={`text-center text-[11px] font-medium pb-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 px-3 pb-4">
                                {calendarDays.map((day, idx) => {
                                    const isSelected = selectedDate === day.date && day.isCurrentMonth;
                                    const dots = day.isCurrentMonth ? getDots(day, isSelected) : [];
                                    const dow = idx % 7;

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => day.isCurrentMonth && setSelectedDate(day.date)}
                                            disabled={!day.isCurrentMonth}
                                            className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all duration-150 ${!day.isCurrentMonth ? 'opacity-20 cursor-default' :
                                                isSelected ? 'bg-primary text-white shadow-lg shadow-primary/20' :
                                                    day.isToday ? 'bg-primary/8 ring-1 ring-primary/30' :
                                                        day.isMissed ? 'bg-amber-50 dark:bg-amber-900/10' :
                                                            'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                }`}
                                        >
                                            <span className={`text-sm leading-6 font-medium ${!day.isCurrentMonth ? 'text-gray-300 dark:text-gray-700' :
                                                isSelected ? 'text-white' :
                                                    day.holidays.length > 0 ? 'text-red-500' :
                                                        day.isMissed ? 'text-amber-500' :
                                                            dow === 0 ? 'text-red-400/70' :
                                                                dow === 6 ? 'text-blue-400/70' :
                                                                    'text-gray-700 dark:text-gray-300'
                                                }`}>
                                                {day.day}
                                            </span>
                                            {dots.length > 0 && (
                                                <div className="flex items-center gap-0.5 mt-0.5">
                                                    {dots.map((dot, di) => (
                                                        <span key={di} className={`w-1.5 h-1.5 rounded-full ${dot.className}`} />
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ──── Right Panel ──── */}
                    <div className="lg:w-80 flex flex-col gap-4">

                        {/* Day Detail */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                            {selectedDayInfo ? (
                                <>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                        {selectedDayInfo.day} {THAI_MONTHS[month]} {year + 543}
                                    </h3>

                                    {/* Holiday */}
                                    {selectedDayInfo.holidays.map((h, i) => (
                                        <DetailRow key={`h${i}`} icon="celebration" color="red" title={h.name} subtitle="วันหยุดบริษัท" />
                                    ))}

                                    {/* Attendance */}
                                    {selectedDayInfo.attendance && selectedDayInfo.attendance.clock_in && (
                                        <DetailRow
                                            icon="check_circle"
                                            color="emerald"
                                            title={`เข้า ${selectedDayInfo.attendance.clock_in?.substring(0, 5) || '-'}${selectedDayInfo.attendance.clock_out ? ` — ออก ${selectedDayInfo.attendance.clock_out.substring(0, 5)}` : ''}`}
                                            subtitle={selectedDayInfo.attendance.location || 'ไม่ระบุสถานที่'}
                                        />
                                    )}

                                    {/* Partial attendance warning */}
                                    {selectedDayInfo.partial && (
                                        <DetailRow
                                            icon="warning"
                                            color="orange"
                                            title={selectedDayInfo.partial.issue === 'no_clock_out' ? 'ลงเวลาเข้า แต่ไม่ได้ลงเวลาออก' : 'ลงเวลาออก แต่ไม่ได้ลงเวลาเข้า'}
                                            subtitle="กรุณาตรวจสอบ"
                                        />
                                    )}

                                    {/* Missed */}
                                    {selectedDayInfo.isMissed && (
                                        <DetailRow icon="error_outline" color="amber" title="ไม่พบการลงเวลา" subtitle="วันทำงาน (จ-ศ) ที่ไม่ได้ลงเวลาเข้า" />
                                    )}

                                    {/* Leaves */}
                                    {selectedDayInfo.leaves.map((l, i) => (
                                        <DetailRow
                                            key={`l${i}`}
                                            icon={l.status === 'pending' ? 'schedule' : 'event_busy'}
                                            color="violet"
                                            title={l.leave_type}
                                            subtitle={l.status === 'pending' ? 'รอการอนุมัติ' : 'อนุมัติแล้ว'}
                                        />
                                    ))}

                                    {/* Nothing */}
                                    {!selectedDayInfo.holidays.length && !selectedDayInfo.attendance && !selectedDayInfo.leaves.length && !selectedDayInfo.isMissed && !selectedDayInfo.partial && (
                                        <div className="text-center py-4">
                                            <span className="material-icons-round text-3xl text-gray-200 dark:text-gray-700">event_available</span>
                                            <p className="text-xs text-gray-400 mt-1.5">
                                                {selectedDayInfo.isWeekend ? 'วันหยุดสุดสัปดาห์' : selectedDayInfo.isFuture ? 'ยังไม่ถึงวัน' : 'ไม่มีข้อมูล'}
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <span className="material-icons-round text-4xl text-gray-200 dark:text-gray-700">touch_app</span>
                                    <p className="text-xs text-gray-400 mt-2">แตะวันที่เพื่อดูรายละเอียด</p>
                                </div>
                            )}
                        </div>

                        {/* Legend */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">สัญลักษณ์</h3>
                            <div className="space-y-2">
                                <LegendItem color="bg-red-400" label="วันหยุดบริษัท" />
                                <LegendItem color="bg-emerald-400" label="วันมาทำงาน" />
                                <LegendItem color="bg-violet-400" label="วันลาต่างๆ" />
                                <LegendItem color="bg-amber-400" label="ลืมลงเวลา (จ-ศ)" />
                                <LegendItem color="bg-orange-400" label="ลงเวลาไม่ครบ" />
                            </div>
                        </div>

                        {/* Monthly Summary */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">สรุปเดือนนี้</h3>
                            <table className="w-full text-xs">
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    <SummaryRow dot="bg-emerald-400" label="วันทำงาน" value={summary.workDays} unit="วัน" />
                                    <SummaryRow dot="bg-red-400" label="วันหยุด" value={summary.holidays} unit="วัน" />
                                    <SummaryRow dot="bg-violet-400" label="วันลา" value={summary.leaveDays} unit="วัน" />
                                    <SummaryRow dot="bg-amber-400" label="ลืมลงเวลา" value={summary.missed} unit="วัน" />
                                    <SummaryRow dot="bg-orange-400" label="ลงเวลาไม่ครบ" value={summary.partial} unit="วัน" />
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Sub-components ───
const DetailRow: React.FC<{ icon: string; color: string; title: string; subtitle: string }> = ({ icon, color, title, subtitle }) => {
    const bgMap: Record<string, string> = {
        red: 'bg-red-50 dark:bg-red-900/15',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/15',
        violet: 'bg-violet-50 dark:bg-violet-900/15',
        amber: 'bg-amber-50 dark:bg-amber-900/15',
        orange: 'bg-orange-50 dark:bg-orange-900/15',
    };
    const txtMap: Record<string, string> = {
        red: 'text-red-500',
        emerald: 'text-emerald-500',
        violet: 'text-violet-500',
        amber: 'text-amber-500',
        orange: 'text-orange-500',
    };
    return (
        <div className={`flex items-center gap-2.5 mb-2.5 p-2.5 rounded-xl ${bgMap[color] || bgMap.violet}`}>
            <span className={`material-icons-round text-lg ${txtMap[color] || txtMap.violet}`}>{icon}</span>
            <div className="min-w-0">
                <p className={`text-xs font-medium ${txtMap[color] || txtMap.violet}`}>{title}</p>
                <p className="text-[10px] text-gray-400">{subtitle}</p>
            </div>
        </div>
    );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div className="flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </div>
);

const SummaryRow: React.FC<{ dot: string; label: string; value: number; unit: string }> = ({ dot, label, value, unit }) => (
    <tr>
        <td className="py-2 pr-2">
            <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
        </td>
        <td className="py-2 text-gray-600 dark:text-gray-400">{label}</td>
        <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{value}</td>
        <td className="py-2 pl-1 text-gray-400">{unit}</td>
    </tr>
);

export default CalendarScreen;
