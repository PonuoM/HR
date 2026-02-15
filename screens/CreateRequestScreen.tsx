import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getLeaveTypes, getLeaveQuotas, getWorkLocations, getEmployee, createLeaveRequest, createTimeRecord, uploadFile } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import DatePickerModal from '../components/DatePickerModal';

// Calculate leave days based on department work hours
function calcLeaveDays(start: string, end: string, workHoursPerDay: number): number {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    const diffMs = e.getTime() - s.getTime();
    if (diffMs <= 0) return 0;

    const diffHours = diffMs / (1000 * 60 * 60);
    const hpd = workHoursPerDay || 8;

    // If same calendar day → partial day based on hours
    if (s.toDateString() === e.toDateString()) {
        return Math.round((diffHours / hpd) * 100) / 100; // e.g. 4/8 = 0.5 day
    }

    // Multi-day: count calendar days
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days;
}

// Format hours to friendly string
function formatHours(h: number): string {
    if (h >= 1) return `${h} ชม.`;
    const mins = Math.round(h * 60);
    return `${mins} นาที`;
}

const CreateRequestScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user: authUser } = useAuth();
    const empId = authUser?.id || '';
    const { data: leaveTypes } = useApi(() => getLeaveTypes(), []);
    const { data: leaveQuotasRaw } = useApi(() => getLeaveQuotas(empId), [empId]);
    const { data: workLocations } = useApi(() => getWorkLocations(), []);
    const { data: empData } = useApi(() => getEmployee(empId), [empId]);

    // Department work hours from employee data
    const workStart = empData?.work_start_time?.substring(0, 5) || '09:00';
    const workEnd = empData?.work_end_time?.substring(0, 5) || '17:00';
    const workHoursPerDay = parseFloat(empData?.work_hours_per_day) || 8;

    const leaveTypeOptions = (leaveTypes || []).map((lt: any) => ({
        value: String(lt.id),
        label: lt.name,
    }));

    // --- TAB STATE ---
    const [requestType, setRequestType] = useState<'leave' | 'ot' | 'timerecord'>('leave');

    // --- LEAVE FORM ---
    const [leaveTypeId, setLeaveTypeId] = useState('1');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [leaveReason, setLeaveReason] = useState('');
    const [leaveSubmitting, setLeaveSubmitting] = useState(false);
    const [leaveFile, setLeaveFile] = useState<File | null>(null);
    const leaveFileRef = useRef<HTMLInputElement>(null);
    const [leaveTypeOpen, setLeaveTypeOpen] = useState(false);
    const leaveTypeDropdownRef = useRef<HTMLDivElement>(null);
    const [calendarOpen, setCalendarOpen] = useState<'start' | 'end' | null>(null);

    const selectedQuota = useMemo(() => {
        return (leaveQuotasRaw || []).find((q: any) => String(q.leave_type_id) === leaveTypeId);
    }, [leaveQuotasRaw, leaveTypeId]);
    const quotaRemaining = selectedQuota ? Number(selectedQuota.remaining) : 0;
    const isUnlimited = selectedQuota?.remaining === -1;
    const quotaTotal = selectedQuota ? Number(selectedQuota.total) : 0;
    const quotaUsed = selectedQuota ? Number(selectedQuota.used) : 0;
    const leaveDays = useMemo(() => calcLeaveDays(startDate, endDate, workHoursPerDay), [startDate, endDate, workHoursPerDay]);

    // Leave hours info
    const leaveHours = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const s = new Date(startDate);
        const e = new Date(endDate);
        return Math.max(0, (e.getTime() - s.getTime()) / (1000 * 60 * 60));
    }, [startDate, endDate]);

    // --- OT FORM ---
    const [otProject, setOtProject] = useState('');
    const [otDate, setOtDate] = useState('');       // yyyy-MM-dd
    const [otStartTime, setOtStartTime] = useState(''); // HH:mm
    const [otEndTime, setOtEndTime] = useState('');     // HH:mm
    const [otReason, setOtReason] = useState('');
    const [otSubmitting, setOtSubmitting] = useState(false);
    const [otFile, setOtFile] = useState<File | null>(null);
    const otFileRef = useRef<HTMLInputElement>(null);
    const [otCalendarOpen, setOtCalendarOpen] = useState(false);

    // Check if selected OT date is a weekend
    const otIsWeekend = useMemo(() => {
        if (!otDate) return false;
        const day = new Date(otDate).getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }, [otDate]);

    // Auto-set times when date changes
    const handleOtDateSelect = (dateStr: string) => {
        setOtDate(dateStr);
        const day = new Date(dateStr).getDay();
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) {
            // Weekend: 09:00 to department end time
            setOtStartTime('09:00');
            setOtEndTime(workEnd);
        } else {
            // Weekday: start from department end time
            setOtStartTime(workEnd);
            setOtEndTime('');
        }
    };

    const otHours = useMemo(() => {
        if (!otDate || !otStartTime || !otEndTime) return 0;
        const s = new Date(`${otDate}T${otStartTime}`);
        const e = new Date(`${otDate}T${otEndTime}`);
        const diffH = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
        return diffH > 0 ? Math.round(diffH * 10) / 10 : 0;
    }, [otDate, otStartTime, otEndTime]);

    // Full datetime strings for submit
    const otStart = otDate && otStartTime ? `${otDate}T${otStartTime}` : '';
    const otEnd = otDate && otEndTime ? `${otDate}T${otEndTime}` : '';

    // --- TIME RECORD FORM ---
    const [trForm, setTrForm] = useState({
        record_date: '', clock_in_time: '', clock_out_time: '', location_id: '', reason: '',
    });
    const [trSubmitting, setTrSubmitting] = useState(false);
    const [trCalendarOpen, setTrCalendarOpen] = useState(false);
    const [trLocationOpen, setTrLocationOpen] = useState(false);
    const [trCustomLocation, setTrCustomLocation] = useState('');
    const [trUseCustom, setTrUseCustom] = useState(false);

    const handleTrDateSelect = (dateStr: string) => {
        setTrForm(prev => ({
            ...prev,
            record_date: dateStr,
            clock_in_time: workStart,
            clock_out_time: workEnd,
        }));
    };

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast('เบราว์เซอร์ไม่รองรับ GPS', 'warning');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setTrCustomLocation(`พิกัด ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                setTrUseCustom(true);
                setTrForm(prev => ({ ...prev, location_id: '' }));
                toast('ดึงพิกัดสำเร็จ', 'success');
            },
            () => toast('ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาต GPS', 'warning'),
            { enableHighAccuracy: true }
        );
    };

    const activeLocations = (workLocations || []).filter((wl: any) => wl.is_active);

    // ===== Auto-set time helpers =====
    // Track previous date-only to detect date changes (not just time edits)
    const prevDateRef = React.useRef('');

    const handleStartDateChange = (val: string) => {
        if (!val) { setStartDate(''); return; }
        const dateOnly = val.split('T')[0];
        const dateChanged = dateOnly !== prevDateRef.current;
        prevDateRef.current = dateOnly;

        if (dateChanged) {
            // User picked a new date → force department work hours
            setStartDate(`${dateOnly}T${workStart}`);
            setEndDate(`${dateOnly}T${workEnd}`);
        } else {
            // User is just adjusting the time on the same date
            setStartDate(val);
        }
    };

    // ===== SUBMIT HANDLERS =====
    const handleLeaveSubmit = async () => {
        if (!startDate || !endDate) return toast('กรุณาเลือกวันที่เริ่ม-สิ้นสุด', 'warning');
        if (leaveDays <= 0) return toast('วันที่สิ้นสุดต้องมากกว่าวันเริ่ม', 'warning');
        if (!leaveReason.trim()) return toast('กรุณาระบุเหตุผลการลา', 'warning');
        if (!isUnlimited && quotaRemaining < leaveDays) {
            return toast(`วันลาคงเหลือไม่เพียงพอ (เหลือ ${quotaRemaining}, ขอ ${leaveDays} วัน)`, 'warning');
        }
        setLeaveSubmitting(true);
        try {
            const result = await createLeaveRequest({
                employee_id: empId,
                leave_type_id: parseInt(leaveTypeId),
                start_date: startDate,
                end_date: endDate,
                total_days: leaveDays,
                reason: leaveReason.trim(),
            });
            if (leaveFile) {
                try { await uploadFile(leaveFile, 'leave_attachment', String(result.id)); } catch { }
            }
            toast('ส่งใบลาเรียบร้อย', 'success');
            navigate(-1);
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setLeaveSubmitting(false);
        }
    };

    const handleOtSubmit = async () => {
        if (!otDate) return toast('กรุณาเลือกวันที่ OT', 'warning');
        if (!otStartTime || !otEndTime) return toast('กรุณาเลือกเวลาเริ่ม-สิ้นสุด', 'warning');
        if (otHours <= 0) return toast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม', 'warning');
        if (!otProject.trim()) return toast('กรุณาระบุโครงการ/งานที่ทำ', 'warning');
        setOtSubmitting(true);
        try {
            const result = await createLeaveRequest({
                employee_id: empId,
                leave_type_id: 0,
                start_date: otStart,
                end_date: otEnd,
                total_days: otHours,
                reason: `[OT] ${otProject.trim()} — ${otReason.trim()}`,
            });
            if (otFile) {
                try { await uploadFile(otFile, 'ot_attachment', String(result.id)); } catch { }
            }
            toast('ส่งคำขอ OT เรียบร้อย', 'success');
            navigate(-1);
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setOtSubmitting(false);
        }
    };

    const handleTimeRecordSubmit = async () => {
        if (!trForm.record_date || !trForm.clock_in_time) return toast('กรุณาระบุวันที่และเวลาเข้า', 'warning');
        setTrSubmitting(true);
        try {
            const selectedLoc = activeLocations.find((wl: any) => String(wl.id) === trForm.location_id);
            const locationName = trUseCustom ? trCustomLocation : (selectedLoc?.name || 'ไม่ระบุ');
            await createTimeRecord({
                employee_id: empId,
                record_date: trForm.record_date,
                clock_in_time: trForm.clock_in_time,
                clock_out_time: trForm.clock_out_time || null,
                location_id: trUseCustom ? null : (trForm.location_id ? Number(trForm.location_id) : null),
                location_name: locationName,
                reason: trForm.reason,
            });
            toast('บันทึกเวลาเรียบร้อย', 'success');
            navigate(-1);
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setTrSubmitting(false);
        }
    };

    const handleSubmit = () => {
        if (requestType === 'leave') handleLeaveSubmit();
        else if (requestType === 'ot') handleOtSubmit();
        else handleTimeRecordSubmit();
    };

    const isSubmitting = leaveSubmitting || otSubmitting || trSubmitting;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast('ไฟล์ต้องไม่เกิน 5MB', 'warning'); return; }
        setLeaveFile(file);
    };

    const inputCls = "w-full bg-white dark:bg-[#15202b] md:bg-gray-50 md:dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary shadow-sm transition-shadow";
    const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1";

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark font-display relative">
            {/* Header */}
            <header className="bg-white dark:bg-[#15202b] pt-4 md:pt-4 pb-4 px-4 shadow-sm z-20 flex justify-between items-center sticky top-0 md:bg-white/90 md:backdrop-blur-md">
                <button onClick={() => navigate(-1)} className="text-slate-500 dark:text-slate-400 text-base font-medium active:opacity-70 flex items-center gap-1">
                    <span className="material-icons-round text-lg">arrow_back</span>
                    <span>ยกเลิก</span>
                </button>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">สร้างคำขอใหม่</h1>
                <button onClick={handleSubmit} disabled={isSubmitting} className="text-primary font-bold disabled:opacity-50">
                    {isSubmitting ? '...' : 'บันทึก'}
                </button>
            </header>

            <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-32">
                <div className="max-w-2xl mx-auto w-full">

                    {/* Tabs */}
                    <div className="mt-6 mb-6">
                        <div className="bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl flex">
                            {([
                                { key: 'leave' as const, label: 'ใบลา', icon: 'beach_access' },
                                { key: 'ot' as const, label: 'ขอโอที', icon: 'access_time' },
                                { key: 'timerecord' as const, label: 'บันทึกเวลา', icon: 'edit_calendar' },
                            ]).map(tab => (
                                <button key={tab.key} onClick={() => setRequestType(tab.key)}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${requestType === tab.key ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                                    <span className="material-icons-round text-sm">{tab.icon}</span>{tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 md:p-8 md:rounded-2xl md:shadow-sm md:border md:border-gray-100 md:dark:border-gray-700 space-y-5">

                        {/* =============== LEAVE FORM =============== */}
                        {requestType === 'leave' && (
                            <>
                                {/* Department work hours info */}
                                <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-slate-500">
                                    <span className="material-icons-round text-sm">schedule</span>
                                    เวลาทำงานแผนกของคุณ: {workStart} - {workEnd} ({workHoursPerDay} ชม./วัน)
                                </div>

                                {/* Leave Type */}
                                <div className="space-y-2">
                                    <label className={labelCls}>ประเภทการลา</label>
                                    <div className="relative" ref={leaveTypeDropdownRef}>
                                        <button type="button" onClick={() => setLeaveTypeOpen(!leaveTypeOpen)} className={`${inputCls} text-left flex items-center justify-between !rounded-2xl`}>
                                            <span>{leaveTypeOptions.find((o: any) => o.value === leaveTypeId)?.label || 'เลือกประเภท'}</span>
                                            <span className={`material-icons-round text-lg text-slate-400 transition-transform ${leaveTypeOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
                                        </button>
                                        {leaveTypeOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setLeaveTypeOpen(false)} />
                                                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                                    {leaveTypeOptions.map((opt: any) => (
                                                        <button key={opt.value} type="button" onClick={() => { setLeaveTypeId(opt.value); setLeaveTypeOpen(false); }}
                                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${opt.value === leaveTypeId ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="px-1">
                                        <span className={`text-xs flex items-center gap-1 ${isUnlimited ? 'text-blue-600 dark:text-blue-400' : quotaRemaining > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                            <span className="material-icons-round text-xs">{isUnlimited ? 'all_inclusive' : quotaRemaining > 0 ? 'check_circle' : 'error'}</span>
                                            {isUnlimited ? 'ไม่จำกัดจำนวนวัน' : `วันลาคงเหลือ: ${quotaRemaining} / ${quotaTotal} วัน (ใช้แล้ว ${quotaUsed} วัน)`}
                                        </span>
                                    </div>
                                </div>

                                {/* Day Count — compact */}
                                <div className={`rounded-lg px-3 py-2 flex items-center justify-between border ${leaveDays > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700'}`}>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`material-icons-round text-sm ${leaveDays > 0 ? 'text-orange-500' : 'text-slate-400'}`}>calculate</span>
                                        <span className={`text-xs font-medium ${leaveDays > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-slate-500'}`}>
                                            คำนวณวันลา {leaveDays > 0 && leaveDays < 1 ? `(${formatHours(leaveHours)})` : ''}
                                        </span>
                                    </div>
                                    <span className={`text-sm font-bold ${leaveDays > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-slate-400'}`}>
                                        {leaveDays > 0 ? `${leaveDays} วัน` : '— วัน'}
                                    </span>
                                </div>

                                {/* Date Pickers — custom popup calendar */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>วันที่เริ่ม</label>
                                        <button type="button" onClick={() => setCalendarOpen('start')} className={`${inputCls} text-left flex items-center justify-between`}>
                                            <span className={startDate ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                                                {startDate ? new Date(startDate.split('T')[0]).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/yyyy'}
                                            </span>
                                            <span className="material-icons-round text-sm text-slate-400">calendar_today</span>
                                        </button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>วันที่สิ้นสุด</label>
                                        <button type="button" onClick={() => setCalendarOpen('end')} className={`${inputCls} text-left flex items-center justify-between`}>
                                            <span className={endDate ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                                                {endDate ? new Date(endDate.split('T')[0]).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/yyyy'}
                                            </span>
                                            <span className="material-icons-round text-sm text-slate-400">calendar_today</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>เวลาเริ่ม</label>
                                        <input type="time" value={startDate.split('T')[1] || ''} onChange={(e) => {
                                            const d = startDate.split('T')[0];
                                            if (d) setStartDate(`${d}T${e.target.value}`);
                                        }} className={inputCls} disabled={!startDate} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>เวลาสิ้นสุด</label>
                                        <input type="time" value={endDate.split('T')[1] || ''} onChange={(e) => {
                                            const d = endDate.split('T')[0];
                                            if (d) setEndDate(`${d}T${e.target.value}`);
                                        }} className={inputCls} disabled={!endDate} />
                                    </div>
                                </div>

                                {/* Calendar Modal */}
                                {calendarOpen === 'start' && (
                                    <DatePickerModal
                                        title="เลือกวันที่เริ่ม"
                                        value={startDate.split('T')[0] || ''}
                                        onSelect={(d) => { handleStartDateChange(`${d}T${workStart}`); setCalendarOpen(null); }}
                                        onClose={() => setCalendarOpen(null)}
                                    />
                                )}
                                {calendarOpen === 'end' && (
                                    <DatePickerModal
                                        title="เลือกวันที่สิ้นสุด"
                                        value={endDate.split('T')[0] || ''}
                                        min={startDate.split('T')[0] || ''}
                                        onSelect={(d) => { setEndDate(`${d}T${endDate.split('T')[1] || workEnd}`); setCalendarOpen(null); }}
                                        onClose={() => setCalendarOpen(null)}
                                    />
                                )}

                                {/* Reason */}
                                <div className="space-y-2">
                                    <label className={labelCls}>เหตุผลการลา</label>
                                    <div className="relative">
                                        <textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value.slice(0, 200))} className={`${inputCls} resize-none !py-2.5`} placeholder="อธิบายเหตุผลการลา..." rows={3} />
                                        <span className="absolute bottom-3 right-3 text-xs text-slate-400">{leaveReason.length}/200</span>
                                    </div>
                                </div>

                                {/* File Attachment */}
                                <div className="space-y-2">
                                    <label className={labelCls}>เอกสารแนบ</label>
                                    <input ref={leaveFileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
                                    {leaveFile ? (
                                        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3.5">
                                            <span className="material-icons-round text-green-600 text-lg">description</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-green-800 dark:text-green-300 truncate">{leaveFile.name}</p>
                                                <p className="text-xs text-green-600 dark:text-green-400">{(leaveFile.size / 1024).toFixed(0)} KB</p>
                                            </div>
                                            <button onClick={() => { setLeaveFile(null); if (leaveFileRef.current) leaveFileRef.current.value = ''; }} className="text-red-400 hover:text-red-600">
                                                <span className="material-icons-round text-lg">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => leaveFileRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-3 px-4 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]">
                                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">ใบรับรองแพทย์ / หลักฐาน (ไม่เกิน 5MB)</span>
                                        </button>
                                    )}
                                </div>
                            </>
                        )}

                        {/* =============== OT FORM =============== */}
                        {requestType === 'ot' && (
                            <>
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-900/30">
                                    <p className="text-xs text-blue-600 dark:text-blue-300 flex gap-2">
                                        <span className="material-icons-round text-sm">info</span>
                                        <span>วันธรรมดา: เริ่มคิดหลังเลิกงาน ({workEnd} น.) · วันหยุด เสาร์-อาทิตย์: 09:00 – {workEnd} น.</span>
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className={labelCls}>โครงการ / งานที่ทำ</label>
                                    <input type="text" value={otProject} onChange={(e) => setOtProject(e.target.value)} placeholder="เช่น Project Alpha, ปิดงบประจำปี" className={inputCls} />
                                </div>

                                {/* OT Date Picker */}
                                <div className="space-y-1.5">
                                    <label className={labelCls}>วันที่ OT</label>
                                    <button type="button" onClick={() => setOtCalendarOpen(true)} className={`${inputCls} text-left flex items-center justify-between`}>
                                        <span className={otDate ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                                            {otDate ? new Date(otDate).toLocaleDateString('th-TH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'เลือกวันที่'}
                                        </span>
                                        <span className="material-icons-round text-sm text-slate-400">calendar_today</span>
                                    </button>
                                    {otDate && (
                                        <div className={`flex items-center gap-1.5 px-1 text-xs font-medium ${otIsWeekend ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                            <span className="material-icons-round text-xs">{otIsWeekend ? 'weekend' : 'work'}</span>
                                            {otIsWeekend ? `วันหยุด — OT คิดตั้งแต่ 09:00 – ${workEnd}` : `วันทำงาน — OT คิดตั้งแต่ ${workEnd} เป็นต้นไป`}
                                        </div>
                                    )}
                                </div>
                                {otCalendarOpen && (
                                    <DatePickerModal
                                        title="เลือกวันที่ OT"
                                        value={otDate}
                                        onSelect={(d) => { handleOtDateSelect(d); setOtCalendarOpen(false); }}
                                        onClose={() => setOtCalendarOpen(false)}
                                    />
                                )}

                                {/* Hours Summary */}
                                <div className={`rounded-xl p-3.5 flex items-center justify-between border ${otHours > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`material-icons-round text-lg ${otHours > 0 ? 'text-green-600' : 'text-slate-400'}`}>schedule</span>
                                        <span className={`text-sm font-medium ${otHours > 0 ? 'text-green-700 dark:text-green-300' : 'text-slate-500'}`}>รวมชั่วโมง OT</span>
                                    </div>
                                    <span className={`text-lg font-bold ${otHours > 0 ? 'text-green-700 dark:text-green-300' : 'text-slate-400'}`}>
                                        {otHours > 0 ? `${otHours} ชม.` : '— ชม.'}
                                    </span>
                                </div>

                                {/* Time Pickers */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>เวลาเริ่ม</label>
                                        <input type="time" value={otStartTime} onChange={(e) => setOtStartTime(e.target.value)} className={inputCls} disabled={!otDate} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>เวลาสิ้นสุด</label>
                                        <input type="time" value={otEndTime} onChange={(e) => setOtEndTime(e.target.value)} className={inputCls} disabled={!otDate} />
                                    </div>
                                </div>

                                {/* Reason */}
                                <div className="space-y-2">
                                    <label className={labelCls}>รายละเอียดงานที่ทำ</label>
                                    <div className="relative">
                                        <textarea value={otReason} onChange={(e) => setOtReason(e.target.value.slice(0, 200))} className={`${inputCls} resize-none !py-3`} placeholder="ระบุรายละเอียดงานที่ต้องทำนอกเวลา..." rows={3} />
                                        <span className="absolute bottom-3 right-3 text-xs text-slate-400">{otReason.length}/200</span>
                                    </div>
                                </div>

                                {/* File Attachment */}
                                <div className="space-y-2">
                                    <label className={labelCls}>แนบหลักฐาน (ถ้ามี)</label>
                                    <input ref={otFileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f && f.size > 5 * 1024 * 1024) { toast('ไฟล์ต้องไม่เกิน 5MB', 'warning'); return; }
                                        setOtFile(f || null);
                                    }} />
                                    {otFile ? (
                                        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl py-2.5 px-4 border border-blue-100 dark:border-blue-900/30">
                                            <span className="material-icons-round text-blue-500 text-lg">description</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{otFile.name}</p>
                                                <p className="text-xs text-slate-400">{(otFile.size / 1024).toFixed(0)} KB</p>
                                            </div>
                                            <button onClick={() => { setOtFile(null); if (otFileRef.current) otFileRef.current.value = ''; }} className="text-red-400 hover:text-red-600">
                                                <span className="material-icons-round text-lg">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => otFileRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-3 px-4 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]">
                                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">แนบไฟล์หลักฐาน (ไม่เกิน 5MB)</span>
                                        </button>
                                    )}
                                </div>
                            </>
                        )}

                        {/* =============== TIME RECORD FORM =============== */}
                        {requestType === 'timerecord' && (
                            <>
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30">
                                    <p className="text-xs text-purple-600 dark:text-purple-300 flex gap-2">
                                        <span className="material-icons-round text-sm">info</span>
                                        <span>ใช้กรณีลืมลงเวลา หรือทำงานต่างสถานที่ เวลาเข้า-ออกจะเซ็ตตามแผนกอัตโนมัติ</span>
                                    </p>
                                </div>

                                {/* Date Picker */}
                                <div className="space-y-1.5">
                                    <label className={labelCls}>วันที่ต้องการบันทึก</label>
                                    <button type="button" onClick={() => setTrCalendarOpen(true)} className={`${inputCls} text-left flex items-center justify-between`}>
                                        <span className={trForm.record_date ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                                            {trForm.record_date ? new Date(trForm.record_date).toLocaleDateString('th-TH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'เลือกวันที่'}
                                        </span>
                                        <span className="material-icons-round text-sm text-slate-400">calendar_today</span>
                                    </button>
                                </div>
                                {trCalendarOpen && (
                                    <DatePickerModal
                                        title="เลือกวันที่บันทึกเวลา"
                                        value={trForm.record_date}
                                        onSelect={(d) => { handleTrDateSelect(d); setTrCalendarOpen(false); }}
                                        onClose={() => setTrCalendarOpen(false)}
                                    />
                                )}

                                {/* Time */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>เวลาเข้า</label>
                                        <input type="time" value={trForm.clock_in_time} onChange={(e) => setTrForm({ ...trForm, clock_in_time: e.target.value })} className={inputCls} disabled={!trForm.record_date} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>เวลาออก</label>
                                        <input type="time" value={trForm.clock_out_time} onChange={(e) => setTrForm({ ...trForm, clock_out_time: e.target.value })} className={inputCls} disabled={!trForm.record_date} />
                                    </div>
                                </div>

                                {/* Location — Custom Dropdown */}
                                <div className="space-y-2">
                                    <label className={labelCls}>สถานที่ทำงาน</label>
                                    <div className="relative">
                                        <button type="button" onClick={() => setTrLocationOpen(!trLocationOpen)} className={`${inputCls} text-left flex items-center justify-between !rounded-2xl`}>
                                            <span className={trForm.location_id || trUseCustom ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                                                {trUseCustom ? `📍 ${trCustomLocation}` : (activeLocations.find((l: any) => String(l.id) === trForm.location_id)?.name || '— เลือกสถานที่ —')}
                                            </span>
                                            <span className={`material-icons-round text-lg text-slate-400 transition-transform ${trLocationOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
                                        </button>
                                        {trLocationOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setTrLocationOpen(false)} />
                                                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg overflow-hidden">
                                                    {activeLocations.map((loc: any) => (
                                                        <button key={loc.id} type="button" onClick={() => { setTrForm(prev => ({ ...prev, location_id: String(loc.id) })); setTrUseCustom(false); setTrLocationOpen(false); }}
                                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${String(loc.id) === trForm.location_id && !trUseCustom ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                                            <span className="material-icons-round text-sm">{String(loc.id) === trForm.location_id && !trUseCustom ? 'check_circle' : 'location_on'}</span>
                                                            {loc.name}
                                                        </button>
                                                    ))}
                                                    {/* Divider */}
                                                    <div className="border-t border-slate-200 dark:border-slate-700" />
                                                    {/* Google Maps / Current Location */}
                                                    <button type="button" onClick={() => { handleGetCurrentLocation(); setTrLocationOpen(false); }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${trUseCustom ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                                        <span className="material-icons-round text-sm">my_location</span>
                                                        ใช้ตำแหน่งปัจจุบัน (GPS)
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {trUseCustom && trCustomLocation && (
                                        <div className="flex items-center gap-2">
                                            <a href={`https://www.google.com/maps?q=${trCustomLocation.replace('พิกัด ', '')}`} target="_blank" rel="noopener noreferrer"
                                                className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
                                                <span className="material-icons-round text-xs">open_in_new</span>
                                                ดูบน Google Maps
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Reason */}
                                <div className="space-y-2">
                                    <label className={labelCls}>เหตุผล</label>
                                    <textarea value={trForm.reason} onChange={(e) => setTrForm({ ...trForm, reason: e.target.value })} className={`${inputCls} resize-none !py-3`} placeholder="เช่น ลืมลงเวลา / ไปทำงานที่สาขาเชียงใหม่" rows={3} />
                                </div>
                            </>
                        )}

                        {/* Approval Steps — Informational */}
                        <div className="pt-4 pb-2">
                            <label className={`${labelCls} mb-4`}>ขั้นตอนการอนุมัติ</label>
                            <div className="flex items-center justify-between relative px-2">
                                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 dark:bg-slate-700 -z-10 -translate-y-3"></div>
                                {[
                                    { label: 'ส่งคำขอ', active: true, icon: 'check' },
                                    { label: 'หัวหน้างาน', active: false, num: '1' },
                                    { label: 'HR', active: false, num: '2' },
                                ].map((step, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-background-dark md:ring-white md:dark:ring-gray-800 ${step.active ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                            {step.active ? <span className="material-icons text-white text-[10px]">{step.icon}</span> : <span className="text-[10px] font-bold text-slate-500">{step.num}</span>}
                                        </div>
                                        <span className={`text-[10px] font-medium uppercase ${step.active ? 'text-primary font-semibold' : 'text-slate-400'}`}>{step.label}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 text-center mt-3">* แสดงลำดับการอนุมัติเท่านั้น</p>
                        </div>
                    </div>
                </div>
            </main>

        </div>
    );
};

export default CreateRequestScreen;