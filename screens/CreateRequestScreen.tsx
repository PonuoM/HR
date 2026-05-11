import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getLeaveTypes, getLeaveQuotas, getWorkLocations, getEmployee, createLeaveRequest, createTimeRecord, uploadFile, getAllowanceTypes, createAllowanceRequest } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import DatePickerModal from '../components/DatePickerModal';
import LocationPickerModal, { LocationData } from '../components/LocationPickerModal';

// Calculate leave days based on department work hours.
// Same-day partial leaves are snapped UP to the nearest 0.5 day —
// HR rule: no hourly leave, minimum half-day. This makes 0.5 day mean
// the same effective time-off regardless of dept hours (7 vs 8 vs 9 hrs).
function calcLeaveDays(start: string, end: string, workHoursPerDay: number): number {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    const diffMs = e.getTime() - s.getTime();
    if (diffMs <= 0) return 0;

    const hpd = workHoursPerDay || 8;

    // If same calendar day → partial day based on hours, snapped to 0.5
    if (s.toDateString() === e.toDateString()) {
        const startHour = s.getHours() + s.getMinutes() / 60;
        const endHour = e.getHours() + e.getMinutes() / 60;

        let workHours = endHour - startHour;

        // Deduct lunch break (12:00 - 13:00)
        const lunchStart = 12;
        const lunchEnd = 13;
        const overlapStart = Math.max(startHour, lunchStart);
        const overlapEnd = Math.min(endHour, lunchEnd);

        if (overlapEnd > overlapStart) {
            workHours -= (overlapEnd - overlapStart);
        }

        if (workHours <= 0) return 0;
        const fraction = workHours / hpd;
        // Snap UP to nearest 0.5: any partial day = ≥0.5, more than half = 1.0
        return Math.ceil(fraction * 2) / 2;
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
    const { data: allowanceTypesRaw } = useApi(() => getAllowanceTypes(), []);
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
    const [requestType, setRequestType] = useState<'leave' | 'ot' | 'timerecord' | 'allowance'>('leave');

    // --- LEAVE FORM ---
    const [leaveTypeId, setLeaveTypeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [leaveReason, setLeaveReason] = useState('');
    const [leaveSubmitting, setLeaveSubmitting] = useState(false);
    const [leaveFiles, setLeaveFiles] = useState<File[]>([]);
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

    // Auto-select first available leave type based on actual quotas
    useEffect(() => {
        if (!leaveTypeId && leaveQuotasRaw?.length) {
            setLeaveTypeId(String(leaveQuotasRaw[0].leave_type_id));
        } else if (!leaveTypeId && leaveTypeOptions.length) {
            setLeaveTypeId(leaveTypeOptions[0].value);
        }
    }, [leaveQuotasRaw, leaveTypeOptions]);

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
    const [otFiles, setOtFiles] = useState<File[]>([]);
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
        
        const startHour = s.getHours() + s.getMinutes() / 60;
        const endHour = e.getHours() + e.getMinutes() / 60;
        
        let workHours = endHour - startHour;

        // Deduct lunch break (12:00 - 13:00)
        const lunchStart = 12;
        const lunchEnd = 13;
        const overlapStart = Math.max(startHour, lunchStart);
        const overlapEnd = Math.min(endHour, lunchEnd);

        if (overlapEnd > overlapStart) {
            workHours -= (overlapEnd - overlapStart);
        }

        return workHours > 0 ? Math.round(workHours * 10) / 10 : 0;
    }, [otDate, otStartTime, otEndTime]);

    // Full datetime strings for submit
    const otStart = otDate && otStartTime ? `${otDate}T${otStartTime}` : '';
    const otEnd = otDate && otEndTime ? `${otDate}T${otEndTime}` : '';

    // --- TIME RECORD FORM ---
    const [trCorrectionType, setTrCorrectionType] = useState<'clock_in' | 'clock_out' | 'both' | 'offsite'>('both');
    const [trForm, setTrForm] = useState({
        record_date: '', clock_in_time: '', clock_out_time: '', location_id: '', reason: '',
    });
    const [trSubmitting, setTrSubmitting] = useState(false);
    const [trCalendarOpen, setTrCalendarOpen] = useState(false);
    const [trLocationOpen, setTrLocationOpen] = useState(false);
    const [trCustomLocation, setTrCustomLocation] = useState('');
    const [trUseCustom, setTrUseCustom] = useState(false);

    // --- ALLOWANCE FORM ---
    const [alType, setAlType] = useState('');
    const [alCustomType, setAlCustomType] = useState('');
    const [alUseCustomType, setAlUseCustomType] = useState(false);
    const [alTypeOpen, setAlTypeOpen] = useState(false);
    const [alLocation, setAlLocation] = useState('');
    const [alLocationAddress, setAlLocationAddress] = useState('');
    const [alLocationDetail, setAlLocationDetail] = useState('');
    const [alLocationLink, setAlLocationLink] = useState('');
    const [alLocationLat, setAlLocationLat] = useState<number | null>(null);
    const [alLocationLng, setAlLocationLng] = useState<number | null>(null);
    const [alLocationPickerOpen, setAlLocationPickerOpen] = useState(false);
    const [alStartDate, setAlStartDate] = useState('');
    const [alEndDate, setAlEndDate] = useState('');
    const [alStartTime, setAlStartTime] = useState('09:00');
    const [alEndTime, setAlEndTime] = useState('17:00');
    const [alAmount, setAlAmount] = useState('');
    const [alReason, setAlReason] = useState('');
    const [alSubmitting, setAlSubmitting] = useState(false);
    const [alFiles, setAlFiles] = useState<File[]>([]);
    const alFileRef = useRef<HTMLInputElement>(null);
    const [alCalendarOpen, setAlCalendarOpen] = useState<'start' | 'end' | null>(null);
    const allowanceTypeOptions = (allowanceTypesRaw || []).map((t: any) => ({ value: t.name, label: t.name }));

    const handleTrDateSelect = (dateStr: string) => {
        setTrForm(prev => ({
            ...prev,
            record_date: dateStr,
            clock_in_time: trCorrectionType !== 'clock_out' ? workStart : '',
            clock_out_time: trCorrectionType !== 'clock_in' ? workEnd : '',
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

        // ── Min 0.5 day for พักร้อน / ลากิจ (HR rule: no hourly leave) ──
        const typeName: string = selectedQuota?.leave_type_name || '';
        const requiresHalfDayMin = /พักร้อน|พักผ่อน|กิจ/.test(typeName);
        if (requiresHalfDayMin && leaveDays < 0.5) {
            return toast(`${typeName} ลาขั้นต่ำ 0.5 วัน (ครึ่งวัน) — ไม่อนุญาตให้ลาเป็นชั่วโมง`, 'warning');
        }

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
            if (leaveFiles.length > 0) {
                try {
                    await Promise.all(leaveFiles.map(f => uploadFile(f, 'leave_attachment', String(result.id))));
                } catch { }
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
            if (otFiles.length > 0) {
                try {
                    await Promise.all(otFiles.map(f => uploadFile(f, 'ot_attachment', String(result.id))));
                } catch { }
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
        if (!trForm.record_date) return toast('กรุณาเลือกวันที่', 'warning');
        if (trCorrectionType !== 'clock_out' && !trForm.clock_in_time) return toast('กรุณาระบุเวลาเข้า', 'warning');
        if (trCorrectionType !== 'clock_in' && !trForm.clock_out_time) return toast('กรุณาระบุเวลาออก', 'warning');
        setTrSubmitting(true);
        try {
            const selectedLoc = activeLocations.find((wl: any) => String(wl.id) === trForm.location_id);
            const locationName = trUseCustom ? trCustomLocation : (selectedLoc?.name || 'ไม่ระบุ');
            await createTimeRecord({
                employee_id: empId,
                record_date: trForm.record_date,
                clock_in_time: trCorrectionType !== 'clock_out' ? trForm.clock_in_time : null,
                clock_out_time: trCorrectionType !== 'clock_in' ? trForm.clock_out_time : null,
                correction_type: trCorrectionType,
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

    const handleAllowanceSubmit = async () => {
        const typeName = alUseCustomType ? alCustomType.trim() : alType;
        if (!typeName) return toast('กรุณาเลือกหรือระบุประเภทเบี้ยเลี้ยง', 'warning');
        if (!alStartDate) return toast('กรุณาเลือกวันที่เริ่มต้น', 'warning');
        if (!alAmount || parseFloat(alAmount) <= 0) return toast('กรุณาระบุจำนวนเงิน', 'warning');
        const locationName = alLocation || 'ไม่ระบุ';
        setAlSubmitting(true);
        try {
            const result = await createAllowanceRequest({
                employee_id: empId,
                allowance_type: typeName,
                location_name: locationName,
                location_address: alLocationAddress,
                location_detail: alLocationDetail,
                location_link: alLocationLink,
                location_lat: alLocationLat,
                location_lng: alLocationLng,
                start_date: alStartDate,
                end_date: alEndDate || alStartDate,
                start_time: alStartTime || null,
                end_time: alEndTime || null,
                amount: parseFloat(alAmount),
                reason: alReason.trim(),
            });
            if (alFiles.length > 0) {
                try {
                    await Promise.all(alFiles.map(f => uploadFile(f, 'allowance_attachment', String(result.id))));
                } catch { }
            }
            toast('ส่งคำขอเบี้ยเลี้ยงเรียบร้อย', 'success');
            navigate(-1);
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setAlSubmitting(false);
        }
    };

    const handleSubmit = () => {
        if (requestType === 'leave') handleLeaveSubmit();
        else if (requestType === 'ot') handleOtSubmit();
        else if (requestType === 'allowance') handleAllowanceSubmit();
        else handleTimeRecordSubmit();
    };

    const isSubmitting = leaveSubmitting || otSubmitting || trSubmitting || alSubmitting;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (!files.length) return;
        
        let validFiles: File[] = [];
        for (const file of files) {
            if (file.size > 20 * 1024 * 1024) { 
                toast(`ไฟล์ ${file.name} เกิน 20MB และถูกข้าม`, 'warning'); 
            } else {
                validFiles.push(file);
            }
        }
        
        if (validFiles.length) {
            setter(prev => [...prev, ...validFiles]);
        }
        
        // Reset input
        e.target.value = '';
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
                                { key: 'ot' as const, label: 'โอที', icon: 'access_time' },
                                { key: 'timerecord' as const, label: 'เวลา', icon: 'edit_calendar' },
                                { key: 'allowance' as const, label: 'เบี้ยเลี้ยง', icon: 'savings' },
                            ]).map(tab => (
                                <button key={tab.key} onClick={() => setRequestType(tab.key)}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center flex items-center justify-center gap-1 ${requestType === tab.key ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
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
                                    <input ref={leaveFileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => handleFileSelect(e, setLeaveFiles)} />
                                    {leaveFiles.length > 0 && (
                                        <div className="space-y-2">
                                            {leaveFiles.map((f, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3.5">
                                                    <span className="material-icons-round text-green-600 text-lg">description</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-green-800 dark:text-green-300 truncate">{f.name}</p>
                                                        <p className="text-xs text-green-600 dark:text-green-400">{(f.size / 1024).toFixed(0)} KB</p>
                                                    </div>
                                                    <button onClick={() => setLeaveFiles(prev => prev.filter((_, index) => index !== i))} className="text-red-400 hover:text-red-600">
                                                        <span className="material-icons-round text-lg">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={() => leaveFileRef.current?.click()} className="w-full mt-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-3 px-4 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]">
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">แนบรับรองแพทย์ / หลักฐาน (หลายไฟล์ได้ ไม่เกินไฟล์ละ 20MB)</span>
                                    </button>
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
                                    <input ref={otFileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => handleFileSelect(e, setOtFiles)} />
                                    {otFiles.length > 0 && (
                                        <div className="space-y-2">
                                            {otFiles.map((f, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl py-2.5 px-4 border border-blue-100 dark:border-blue-900/30">
                                                    <span className="material-icons-round text-blue-500 text-lg">description</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                                                        <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</p>
                                                    </div>
                                                    <button onClick={() => setOtFiles(prev => prev.filter((_, index) => index !== i))} className="text-red-400 hover:text-red-600">
                                                        <span className="material-icons-round text-lg">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={() => otFileRef.current?.click()} className="w-full mt-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-3 px-4 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]">
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">แนบไฟล์หลักฐาน (หลายไฟล์ได้ ไม่เกินไฟล์ละ 20MB)</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {/* =============== TIME RECORD FORM =============== */}
                        {requestType === 'timerecord' && (
                            <>
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30">
                                    <p className="text-xs text-purple-600 dark:text-purple-300 flex gap-2">
                                        <span className="material-icons-round text-sm">info</span>
                                        <span>ใช้กรณีลืมลงเวลา หรือทำงานต่างสถานที่ เลือกประเภทที่ต้องการแก้ไข</span>
                                    </p>
                                </div>

                                {/* Correction Type Selector */}
                                <div className="space-y-1.5">
                                    <label className={labelCls}>ประเภทการแก้ไข</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'clock_in' as const, label: 'ลืมลงเข้า', icon: 'login', color: 'red' },
                                            { value: 'clock_out' as const, label: 'ลืมลงออก', icon: 'logout', color: 'blue' },
                                            { value: 'both' as const, label: 'ลืมทั้งคู่', icon: 'swap_horiz', color: 'amber' },
                                            { value: 'offsite' as const, label: 'นอกสถานที่', icon: 'location_on', color: 'green' },
                                        ].map(opt => (
                                            <button key={opt.value} type="button"
                                                onClick={() => {
                                                    setTrCorrectionType(opt.value);
                                                    setTrForm(prev => ({
                                                        ...prev,
                                                        clock_in_time: opt.value !== 'clock_out' && prev.record_date ? workStart : '',
                                                        clock_out_time: opt.value !== 'clock_in' && prev.record_date ? workEnd : '',
                                                    }));
                                                }}
                                                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-xs font-medium ${
                                                    trCorrectionType === opt.value
                                                        ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-900/30 text-${opt.color}-700 dark:text-${opt.color}-300 shadow-sm`
                                                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                                                }`}
                                            >
                                                <span className={`material-icons-round text-lg ${
                                                    trCorrectionType === opt.value ? `text-${opt.color}-500` : 'text-slate-400'
                                                }`}>{opt.icon}</span>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
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

                                {/* Time Fields — conditional */}
                                <div className={`grid gap-3 ${trCorrectionType === 'both' || trCorrectionType === 'offsite' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {(trCorrectionType !== 'clock_out') && (
                                        <div className="space-y-1.5">
                                            <label className={labelCls}>เวลาเข้า</label>
                                            <input type="time" value={trForm.clock_in_time} onChange={(e) => setTrForm({ ...trForm, clock_in_time: e.target.value })} className={inputCls} disabled={!trForm.record_date} />
                                        </div>
                                    )}
                                    {trCorrectionType !== 'clock_in' && (
                                        <div className="space-y-1.5">
                                            <label className={labelCls}>เวลาออก</label>
                                            <input type="time" value={trForm.clock_out_time} onChange={(e) => setTrForm({ ...trForm, clock_out_time: e.target.value })} className={inputCls} disabled={!trForm.record_date} />
                                        </div>
                                    )}
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

                        {/* =============== ALLOWANCE FORM =============== */}
                        {requestType === 'allowance' && (
                            <>
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900/30">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-300 flex gap-2">
                                        <span className="material-icons-round text-sm">info</span>
                                        <span>ระบุประเภทเบี้ยเลี้ยง สถานที่ วันเวลา และจำนวนเงินที่ต้องการเบิก</span>
                                    </p>
                                </div>

                                {/* Allowance Type — Hybrid Dropdown */}
                                <div className="space-y-2">
                                    <label className={labelCls}>ประเภทเบี้ยเลี้ยง</label>
                                    {!alUseCustomType ? (
                                        <div className="relative">
                                            <button type="button" onClick={() => setAlTypeOpen(!alTypeOpen)} className={`${inputCls} text-left flex items-center justify-between !rounded-2xl`}>
                                                <span className={alType ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                                                    {alType || '— เลือกประเภท —'}
                                                </span>
                                                <span className={`material-icons-round text-lg text-slate-400 transition-transform ${alTypeOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
                                            </button>
                                            {alTypeOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setAlTypeOpen(false)} />
                                                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg overflow-hidden">
                                                        {allowanceTypeOptions.map((opt: any) => (
                                                            <button key={opt.value} type="button" onClick={() => { setAlType(opt.value); setAlTypeOpen(false); }}
                                                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${opt.value === alType ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                                                <span className="material-icons-round text-sm">{opt.value === alType ? 'check_circle' : 'label'}</span>
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                        <div className="border-t border-slate-200 dark:border-slate-700" />
                                                        <button type="button" onClick={() => { setAlUseCustomType(true); setAlTypeOpen(false); }}
                                                            className="w-full text-left px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 font-medium">
                                                            <span className="material-icons-round text-sm">add_circle</span>
                                                            พิมพ์ประเภทใหม่...
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input type="text" value={alCustomType} onChange={(e) => setAlCustomType(e.target.value)}
                                                placeholder="พิมพ์ประเภทใหม่ เช่น ค่ารถ" className={`${inputCls} flex-1`} autoFocus />
                                            <button type="button" onClick={() => { setAlUseCustomType(false); setAlCustomType(''); }}
                                                className="px-3 py-2 text-sm text-slate-500 hover:text-primary border border-slate-200 dark:border-slate-700 rounded-xl">
                                                <span className="material-icons-round text-sm">list</span>
                                            </button>
                                        </div>
                                    )}
                                    {alUseCustomType && alCustomType && (
                                        <p className="text-xs text-blue-500 flex items-center gap-1 px-1">
                                            <span className="material-icons-round text-xs">auto_awesome</span>
                                            ประเภทนี้จะถูกบันทึกอัตโนมัติเพื่อใช้ครั้งถัดไป
                                        </p>
                                    )}
                                </div>

                                {/* Location — Map Picker */}
                                <div className="space-y-2">
                                    <label className={labelCls}>สถานที่</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <span className="material-icons-round text-lg">location_on</span>
                                            </span>
                                            <input
                                                type="text"
                                                value={alLocation}
                                                onChange={(e) => setAlLocation(e.target.value)}
                                                placeholder="พิมพ์ชื่อสถานที่..."
                                                className={`${inputCls} !pl-10`}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAlLocationPickerOpen(true)}
                                            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-1.5 text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
                                        >
                                            <span className="material-icons-round text-base">map</span>
                                            แผนที่
                                        </button>
                                    </div>
                                    {/* Show extracted address if available */}
                                    {alLocationAddress && (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                            <span className="material-icons-round text-sm mt-0.5 shrink-0">pin_drop</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="break-words">{alLocationAddress}</p>
                                                {alLocationLat && alLocationLng && (
                                                    <p className="text-[10px] text-blue-400 mt-0.5 font-mono">{alLocationLat.toFixed(6)}, {alLocationLng.toFixed(6)}</p>
                                                )}
                                                {alLocationLink && (
                                                    <a href={alLocationLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5">
                                                        <span className="material-icons-round text-[10px]">open_in_new</span>
                                                        เปิด Google Maps
                                                    </a>
                                                )}
                                            </div>
                                            <button type="button" onClick={() => { setAlLocationAddress(''); setAlLocationLink(''); setAlLocationLat(null); setAlLocationLng(null); }}
                                                className="text-blue-400 hover:text-blue-600 shrink-0">
                                                <span className="material-icons-round text-sm">close</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Location detail — employee additional info */}
                                <div className="space-y-1.5">
                                    <label className={labelCls}>รายละเอียดสถานที่ <span className="text-slate-400 font-normal">(เพิ่มเติม)</span></label>
                                    <textarea
                                        value={alLocationDetail}
                                        onChange={(e) => setAlLocationDetail(e.target.value)}
                                        placeholder="เช่น อาคาร A ชั้น 3 ห้อง 301 / หน้าร้าน 7-11 สาขาตลาดสด..."
                                        rows={2}
                                        className={`${inputCls} resize-none`}
                                    />
                                </div>

                                {alLocationPickerOpen && (
                                    <LocationPickerModal
                                        initialName={alLocation}
                                        onSelect={(data: LocationData) => {
                                            setAlLocation(data.name);
                                            setAlLocationAddress(data.address);
                                            setAlLocationLink(data.link);
                                            setAlLocationLat(data.lat);
                                            setAlLocationLng(data.lng);
                                            setAlLocationPickerOpen(false);
                                        }}
                                        onClose={() => setAlLocationPickerOpen(false)}
                                    />
                                )}

                                {/* Date Range */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>วันที่เริ่ม</label>
                                        <button type="button" onClick={() => setAlCalendarOpen('start')} className={`${inputCls} text-left flex items-center justify-between`}>
                                            <span className={alStartDate ? 'text-slate-900 dark:text-white text-xs' : 'text-slate-400 text-xs'}>
                                                {alStartDate ? new Date(alStartDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : 'เลือกวัน'}
                                            </span>
                                            <span className="material-icons-round text-sm text-slate-400">calendar_today</span>
                                        </button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>ถึงวันที่</label>
                                        <button type="button" onClick={() => setAlCalendarOpen('end')} className={`${inputCls} text-left flex items-center justify-between`}>
                                            <span className={alEndDate ? 'text-slate-900 dark:text-white text-xs' : 'text-slate-400 text-xs'}>
                                                {alEndDate ? new Date(alEndDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : 'เลือกวัน'}
                                            </span>
                                            <span className="material-icons-round text-sm text-slate-400">calendar_today</span>
                                        </button>
                                    </div>
                                </div>
                                {alCalendarOpen && (
                                    <DatePickerModal
                                        title={alCalendarOpen === 'start' ? 'เลือกวันที่เริ่ม' : 'เลือกวันที่สิ้นสุด'}
                                        value={alCalendarOpen === 'start' ? alStartDate : alEndDate}
                                        onSelect={(d) => {
                                            if (alCalendarOpen === 'start') {
                                                setAlStartDate(d);
                                                if (!alEndDate || d > alEndDate) setAlEndDate(d);
                                            } else {
                                                setAlEndDate(d);
                                            }
                                            setAlCalendarOpen(null);
                                        }}
                                        onClose={() => setAlCalendarOpen(null)}
                                    />
                                )}

                                {/* Time — only show after date is selected */}
                                {alStartDate && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelCls}>เวลาเริ่ม</label>
                                            <input type="time" value={alStartTime} onChange={(e) => setAlStartTime(e.target.value)} className={inputCls} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelCls}>เวลาสิ้นสุด</label>
                                            <input type="time" value={alEndTime} onChange={(e) => setAlEndTime(e.target.value)} className={inputCls} />
                                        </div>
                                    </div>
                                )}

                                {/* Amount */}
                                <div className="space-y-2">
                                    <label className={labelCls}>จำนวนเงินขอเบิก (บาท)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">฿</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={alAmount}
                                            onChange={(e) => {
                                                let v = e.target.value.replace(/[^0-9.]/g, '');
                                                // Strip leading zeros (keep "0." for decimals)
                                                v = v.replace(/^0+(?=\d)/, '');
                                                setAlAmount(v);
                                            }}
                                            placeholder="0.00"
                                            className={`${inputCls} !pl-8 text-right text-lg font-semibold`}
                                        />
                                    </div>
                                    {parseFloat(alAmount) > 0 && (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-1">
                                            <span className="material-icons-round text-xs">payments</span>
                                            ขอเบิก ฿{parseFloat(alAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </p>
                                    )}
                                </div>

                                {/* Reason */}
                                <div className="space-y-2">
                                    <label className={labelCls}>หมายเหตุ</label>
                                    <div className="relative">
                                        <textarea value={alReason} onChange={(e) => setAlReason(e.target.value.slice(0, 300))} className={`${inputCls} resize-none !py-3`} placeholder="ระบุรายละเอียดเพิ่มเติม..." rows={3} />
                                        <span className="absolute bottom-3 right-3 text-xs text-slate-400">{alReason.length}/300</span>
                                    </div>
                                </div>

                                {/* File Attachment */}
                                <div className="space-y-2">
                                    <label className={labelCls}>แนบใบเสร็จ / หลักฐาน (ถ้ามี)</label>
                                    <input ref={alFileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => handleFileSelect(e, setAlFiles)} />
                                    {alFiles.length > 0 && (
                                        <div className="space-y-2">
                                            {alFiles.map((f, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl py-2.5 px-4 border border-emerald-100 dark:border-emerald-900/30">
                                                    <span className="material-icons-round text-emerald-500 text-lg">image</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                                                        <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</p>
                                                    </div>
                                                    <button onClick={() => setAlFiles(prev => prev.filter((_, index) => index !== i))} className="text-red-400 hover:text-red-600">
                                                        <span className="material-icons-round text-lg">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={() => alFileRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-3 px-4 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group active:scale-[0.98]">
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">📸 แนบรูปใบเสร็จ (หลายรูปได้ รูปละไม่เกิน 20MB)</span>
                                    </button>
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