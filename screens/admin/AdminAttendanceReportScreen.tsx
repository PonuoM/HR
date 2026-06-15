import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, getAuthHeaders, getEmployees, getLeaveTypes, getLeaveQuotas, createLeaveRequestAsAdmin, updateOtRate } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ReportRow {
    employee_id: string;
    employee_name: string;
    department: string;
    base_salary: number;
    work_start_time: string;
    expected_work_days: number;
    full_period_work_days: number;
    actual_work_days: number;
    absent_days: number;
    late_count: number;
    late_minutes_total: number;
    early_leave_count: number;
    early_leave_minutes_total: number;
    leave_by_type: { leave_type_id: number; leave_type_name: string; days: number }[];
    total_leave_days: number;
    ot_hours: number;
    total_work_hours: number;
    diligence_eligible: boolean;
}

interface ReportData {
    period: string;
    start_date: string;
    end_date: string;
    expected_work_days: number;
    full_period_work_days: number;
    leave_types: { id: number; name: string; type: string }[];
    departments: { id: number; name: string }[];
    employees: ReportRow[];
    summary: {
        total_employees: number;
        total_absent_days: number;
        total_late_count: number;
        total_late_minutes: number;
        total_early_leave_count: number;
        total_early_leave_minutes: number;
        total_leave_days: number;
        total_ot_hours: number;
        diligence_eligible_count: number;
    };
}

interface OtEntry {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    hours: number;
    ot_rate: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

interface DailyRow {
    date: string;
    day_of_week: number;
    status: 'present' | 'late' | 'leave' | 'absent' | 'holiday' | 'weekend' | 'future' | 'pre_hire';
    clock_in: string | null;
    clock_out: string | null;
    late_minutes: number;
    work_hours: number;
    leave_type: string | null;
    holiday_name: string | null;
    admin_note: string | null;
    edited_by: string | null;
    edited_at: string | null;
    ot: OtEntry[];
}

interface DailyData {
    employee_id: string;
    employee_name: string;
    department: string;
    work_start_time: string;
    work_end_time: string;
    month: string;
    days: DailyRow[];
    ot_entries: OtEntry[];
}

const DOW_TH = ['', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

const STATUS_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
    present: { label: 'มาปกติ', icon: 'check_circle', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
    late: { label: 'สาย', icon: 'alarm', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
    leave: { label: 'ลา', icon: 'beach_access', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
    absent: { label: 'ขาด', icon: 'event_busy', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
    holiday: { label: 'วันหยุด', icon: 'celebration', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
    weekend: { label: 'วันหยุด', icon: 'weekend', bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-500 dark:text-gray-400' },
    offday_work: { label: 'ทำงานวันหยุด (OT?)', icon: 'more_time', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    future: { label: '-', icon: 'schedule', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-400 dark:text-gray-500' },
    pre_hire: { label: 'ก่อนเข้างาน', icon: 'person_add_disabled', bg: 'bg-slate-100 dark:bg-slate-800/40', text: 'text-slate-500 dark:text-slate-400' },
};

// HTML escape — needed because we build a printable doc as a string and inject
// employee data into it (admin_note, reasons, names are user-controllable).
const esc = (s: any): string => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Build a self-contained printable HTML doc for ALL employees' daily reports.
// Browser renders text natively (vector) → far crisper than html2canvas.
function buildPrintableReportHtml(
    allDaily: { emp: ReportRow; daily: DailyData }[],
    periodLabel: string
): string {
    const dowNames = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

    const statusLabel = (r: DailyRow): string => {
        if (r.status === 'leave' && r.leave_type) return `ลา (${r.leave_type})`;
        if (r.status === 'holiday') return 'หยุดนักขัตฤกษ์';
        return ({ present: 'มาทำงาน', late: 'สาย', absent: 'ขาดงาน', leave: 'ลา', weekend: 'วันหยุด', offday_work: 'ทำงานวันหยุด (OT?)', future: '-', pre_hire: 'ยังไม่เข้างาน' } as Record<string, string>)[r.status] || r.status;
    };
    const rowBgClass = (r: DailyRow): string => {
        if (r.status === 'absent') return 'absent';
        if (r.status === 'late') return 'late';
        if (r.status === 'leave') return 'leave';
        if (r.status === 'holiday') return 'holiday';
        if (r.status === 'weekend') return 'weekend';
        if (r.status === 'pre_hire') return 'pre';
        return '';
    };

    const employeePages = allDaily.map(({ emp, daily }) => {
        let cntPresent = 0, cntLate = 0, cntAbsent = 0, cntLeave = 0, totalLateMin = 0;
        const otTotal: Record<string, number> = { '1.0': 0, '1.5': 0, '2.0': 0, '3.0': 0 };
        let otRawHours = 0;
        daily.days.forEach(r => {
            if (r.status === 'present') cntPresent++;
            else if (r.status === 'late') { cntLate++; totalLateMin += r.late_minutes || 0; }
            else if (r.status === 'absent') cntAbsent++;
            else if (r.status === 'leave') cntLeave++;
            (r.ot || []).forEach(o => {
                const key = Number(o.ot_rate).toFixed(1);
                if (otTotal[key] !== undefined) otTotal[key] += o.hours || 0;
                otRawHours += o.hours || 0;
            });
        });
        const fmtOt = (v: number) => v > 0 ? (Math.round(v * 10) / 10).toString() : '';
        const fmtT = (v: number) => v > 0 ? (Math.round(v * 10) / 10).toString() : '–';

        const rowsHtml = daily.days.map(r => {
            const d = new Date(r.date);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
            const otByRate: Record<string, number> = { '1.0': 0, '1.5': 0, '2.0': 0, '3.0': 0 };
            const otNotes: string[] = [];
            (r.ot || []).forEach(o => {
                const key = Number(o.ot_rate).toFixed(1);
                if (otByRate[key] !== undefined) otByRate[key] += o.hours || 0;
                if (o.reason) otNotes.push(o.reason);
            });
            const noteParts: string[] = [];
            if (r.holiday_name) noteParts.push(r.holiday_name);
            if (r.status === 'leave' && r.leave_type) noteParts.push(r.leave_type);
            if (r.status === 'absent') noteParts.push('ไม่มาทำงาน');
            if (r.admin_note) noteParts.push('✎ ' + r.admin_note);

            return `<tr class="${rowBgClass(r)}">
                <td class="c">${esc(dateStr)}</td>
                <td class="c">${esc(dowNames[r.day_of_week] || '')}</td>
                <td class="c${r.status === 'late' ? ' b' : ''}">${esc(r.clock_in ? r.clock_in.substring(0, 5) : '-')}</td>
                <td class="c">${esc(r.clock_out ? r.clock_out.substring(0, 5) : '-')}</td>
                <td class="${r.status === 'late' || r.status === 'absent' ? 'b' : ''}">${esc(statusLabel(r))}</td>
                <td class="c">${r.late_minutes > 0 ? r.late_minutes : ''}</td>
                <td class="c">${r.work_hours > 0 ? Math.round(r.work_hours * 10) / 10 : ''}</td>
                <td class="c ot">${fmtOt(otByRate['1.0'])}</td>
                <td class="c ot">${fmtOt(otByRate['1.5'])}</td>
                <td class="c ot">${fmtOt(otByRate['2.0'])}</td>
                <td class="c ot">${fmtOt(otByRate['3.0'])}</td>
                <td class="n">${esc(otNotes.join(' • '))}</td>
                <td class="n">${esc(noteParts.join(' • '))}</td>
            </tr>`;
        }).join('');

        return `<section class="page">
            <h1>รายงานเข้างานรายวัน — ${esc(periodLabel)}</h1>
            <div class="meta">พนักงาน: <b>${esc(daily.employee_name)}</b> (${esc(daily.employee_id)})</div>
            <div class="meta">
                แผนก: <b>${esc(daily.department || '-')}</b>
                &nbsp;&nbsp;&nbsp;เวลาเข้างาน: <b>${esc((daily.work_start_time || '').substring(0, 5))} น.</b>
                &nbsp;&nbsp;&nbsp;เวลาออกงาน: <b>${esc((daily.work_end_time || '').substring(0, 5) || '-')} น.</b>
            </div>
            <table>
                <colgroup>
                    <col style="width:7%"><col style="width:5%"><col style="width:6%"><col style="width:6%">
                    <col style="width:14%"><col style="width:6%"><col style="width:8%">
                    <col style="width:5%"><col style="width:5%"><col style="width:5%"><col style="width:5%">
                    <col style="width:11%"><col style="width:17%">
                </colgroup>
                <thead>
                    <tr>
                        <th rowspan="2">วันที่</th>
                        <th rowspan="2">วัน</th>
                        <th rowspan="2">เข้างาน</th>
                        <th rowspan="2">ออกงาน</th>
                        <th rowspan="2">สถานะ</th>
                        <th rowspan="2">สาย (นาที)</th>
                        <th rowspan="2">ชม.ทำงาน</th>
                        <th colspan="4">OT (เวลา / อัตรา / ชม.)</th>
                        <th rowspan="2">หมายเหตุ OT</th>
                        <th rowspan="2">หมายเหตุ</th>
                    </tr>
                    <tr>
                        <th>1</th><th>1.5</th><th>2</th><th>3</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr class="sum">
                        <td class="c"><b>สรุป</b></td>
                        <td colspan="4"><b>มา:${cntPresent}&nbsp;&nbsp;สาย:${cntLate}&nbsp;&nbsp;ขาด:${cntAbsent}&nbsp;&nbsp;ลา:${cntLeave}</b></td>
                        <td colspan="2" style="text-align:right"><b>สายรวม ${totalLateMin} นาที</b></td>
                        <td class="c"><b>${fmtT(otTotal['1.0'])}</b></td>
                        <td class="c"><b>${fmtT(otTotal['1.5'])}</b></td>
                        <td class="c"><b>${fmtT(otTotal['2.0'])}</b></td>
                        <td class="c"><b>${fmtT(otTotal['3.0'])}</b></td>
                        <td colspan="2" class="c"><b>OT รวม ${Math.round(otRawHours * 10) / 10} ชม.</b></td>
                    </tr>
                </tbody>
            </table>
            <p class="foot">หมายเหตุ: ชั่วโมง OT แสดงในช่องอัตราที่ตรง (×1 / ×1.5 / ×2 / ×3) — ฝ่ายบัญชีนำไปคำนวณเงินเองตามอัตรา</p>
        </section>`;
    }).join('');

    return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>รายงานเข้างานรายวัน — ${esc(periodLabel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: "Sarabun", "TH Sarabun New", "Tahoma", sans-serif; }
    .page { padding: 0; page-break-after: always; page-break-inside: avoid; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 12pt; font-weight: 700; margin: 0 0 2px 0; }
    .meta { font-size: 9.5pt; margin: 0 0 1px 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4px; font-size: 9.5pt; }
    th, td { border: 1px solid #000; padding: 1px 5px; vertical-align: middle; line-height: 1.3; }
    /* Notes: single-line with ellipsis so rows stay uniform height */
    td.n {
        font-size: 9pt;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    th { background: #d1d5db; font-weight: 700; text-align: center; font-size: 9.5pt; }
    td.c { text-align: center; }
    td.b { font-weight: 700; }
    td.ot { font-weight: 600; text-align: center; }
    tr { page-break-inside: avoid; }
    tr.late td { background: #e5e7eb; }
    tr.absent td { background: #d1d5db; }
    tr.leave td { background: #ededed; }
    tr.holiday td { background: #f3f4f6; }
    tr.weekend td { background: #f9fafb; }
    tr.pre td { background: #fafafa; }
    tr.sum td { background: #9ca3af; font-weight: 700; }
    .foot { font-size: 7.5pt; color: #374151; margin-top: 2px; }
    /* Print-specific */
    @page { size: A4 landscape; margin: 6mm; }
    @media print {
        .toolbar { display: none !important; }
        body { padding-top: 0 !important; }
    }
    /* Onscreen toolbar with hint */
    .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #1f2937; color: #fff; padding: 8px 16px; font-size: 13px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 1000; }
    .toolbar button { background: #3b82f6; color: #fff; border: 0; padding: 6px 14px; border-radius: 4px; font: inherit; cursor: pointer; }
    .toolbar button:hover { background: #2563eb; }
    body { padding-top: 44px; }
    /* Visual page mock onscreen — invisible in print (resets to @page margin) */
    .page { padding: 8mm 6mm; margin: 12px auto; max-width: 297mm; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
    @media print {
        .page { padding: 0; margin: 0; max-width: none; box-shadow: none; }
    }
</style>
</head>
<body>
<div class="toolbar">
    <span>📄 พรีวิว — กด <b>Print</b> เพื่อบันทึกเป็น PDF</span>
    <button onclick="window.print()">🖨️ Print / Save PDF</button>
    <button onclick="window.close()" style="background:#6b7280">ปิด</button>
</div>
${employeePages}
</body>
</html>`;
}

const formatNum = (v: any) => {
    const n = Number(v);
    if (isNaN(n)) return v;
    if (n >= 10000) return n.toLocaleString('en', { maximumFractionDigits: 0 });
    if (Number.isInteger(n)) return n.toString();
    return parseFloat(n.toFixed(2)).toString();
};

const formatTimeDuration = (decimalValue: any) => {
    const num = Number(decimalValue);
    if (isNaN(num) || num <= 0) return '-';
    
    const h = Math.floor(num);
    // Use Math.round to handle floating point inaccuracies (e.g. 8.79 * 60 = 527.4 -> 527 -> wait, 8.79 decimal is 8h 47.4m)
    // Wait, 8.79 * 60 = 527.4? No, 0.79 * 60 = 47.4 -> Math.round is 47.
    // That means 8.79 -> 8 ชม. 47 นาที. Correct.
    const m = Math.round((num - h) * 60);
    
    if (h > 0 && m > 0) return `${h} ชม. ${m} นาที`;
    if (h > 0) return `${h} ชม.`;
    if (m > 0) return `${m} นาที`;
    return '-';
};

const formatMinutesDuration = (minutesValue: any) => {
    const num = Number(minutesValue);
    if (isNaN(num) || num <= 0) return '-';
    
    if (num < 60) return `${num} นาที`;
    
    const h = Math.floor(num / 60);
    const m = Math.round(num % 60);
    
    if (m > 0) return `${h} ชม. ${m} นาที`;
    return `${h} ชม.`;
};

// ─── Date range helper functions ───
const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface QuickRange { label: string; icon: string; getRange: () => [string, string]; }
const QUICK_RANGES: QuickRange[] = [
    { label: 'วันนี้', icon: 'today', getRange: () => { const t = new Date(); return [toDateStr(t), toDateStr(t)]; } },
    { label: 'เมื่อวาน', icon: 'history', getRange: () => { const y = new Date(); y.setDate(y.getDate() - 1); return [toDateStr(y), toDateStr(y)]; } },
    { label: '7 วันย้อนหลัง', icon: 'date_range', getRange: () => { const t = new Date(); const s = new Date(); s.setDate(t.getDate() - 6); return [toDateStr(s), toDateStr(t)]; } },
    { label: '30 วันย้อนหลัง', icon: 'calendar_month', getRange: () => { const t = new Date(); const s = new Date(); s.setDate(t.getDate() - 29); return [toDateStr(s), toDateStr(t)]; } },
    { label: 'อาทิตย์นี้', icon: 'view_week', getRange: () => { const t = new Date(); const dow = t.getDay(); const s = new Date(t); s.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1)); const e = new Date(s); e.setDate(s.getDate() + 6); return [toDateStr(s), toDateStr(e)]; } },
    { label: 'อาทิตย์ที่แล้ว', icon: 'undo', getRange: () => { const t = new Date(); const dow = t.getDay(); const s = new Date(t); s.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1) - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return [toDateStr(s), toDateStr(e)]; } },
    { label: 'เดือนนี้', icon: 'event', getRange: () => { const t = new Date(); const s = new Date(t.getFullYear(), t.getMonth(), 1); const e = new Date(t.getFullYear(), t.getMonth() + 1, 0); return [toDateStr(s), toDateStr(e)]; } },
    { label: 'เดือนที่แล้ว', icon: 'event_repeat', getRange: () => { const t = new Date(); const s = new Date(t.getFullYear(), t.getMonth() - 1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); return [toDateStr(s), toDateStr(e)]; } },
];

const AdminAttendanceReportScreen: React.FC = () => {
    const navigate = useNavigate();
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [empPickerOpen, setEmpPickerOpen] = useState(false);
    const [empSearch, setEmpSearch] = useState('');
    const empPickerRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedDept, setSelectedDept] = useState('');
    const [cutoffMode, setCutoffMode] = useState(false); // ตัดรอบ 20
    const [selectedDate, setSelectedDate] = useState(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    );

    // Custom date range state
    const [showDateRangePicker, setShowDateRangePicker] = useState(false);
    const [customDateFrom, setCustomDateFrom] = useState(toDateStr(now));
    const [customDateTo, setCustomDateTo] = useState(toDateStr(now));
    const [tempDateFrom, setTempDateFrom] = useState(toDateStr(now));
    const [tempDateTo, setTempDateTo] = useState(toDateStr(now));

    // Daily detail modal state
    const [detailEmpId, setDetailEmpId] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<DailyData | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    // Modal-local date range — initialized from outer filter when modal opens, but editable inside
    const [detailDateFrom, setDetailDateFrom] = useState('');
    const [detailDateTo, setDetailDateTo] = useState('');

    // Edit daily attendance state
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editClockIn, setEditClockIn] = useState('');
    const [editClockOut, setEditClockOut] = useState('');
    const [editAdminNote, setEditAdminNote] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    // Per-OT-entry rate update in-flight (entry id → boolean)
    const [otRateUpdating, setOtRateUpdating] = useState<Record<number, boolean>>({});

    // ── PDF export progress (batch HTML generation → ZIP) ──
    const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);

    // ── HR record-leave-on-behalf modal state ──
    const [recordLeaveFor, setRecordLeaveFor] = useState<{ id: string; name: string } | null>(null);
    const [recLeaveTypeId, setRecLeaveTypeId] = useState('');
    const [recLeaveStartDate, setRecLeaveStartDate] = useState('');
    const [recLeaveEndDate, setRecLeaveEndDate] = useState('');
    const [recLeaveReason, setRecLeaveReason] = useState('');
    const [recLeaveSubmitting, setRecLeaveSubmitting] = useState(false);
    const { data: allLeaveTypes } = useApi<any[]>(() => getLeaveTypes(), []);
    const { data: recLeaveQuotas } = useApi<any[]>(
        () => recordLeaveFor ? getLeaveQuotas(recordLeaveFor.id) : Promise.resolve([]),
        [recordLeaveFor?.id]
    );

    // Build API URL
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (viewMode === 'custom') {
            params.set('date_from', customDateFrom);
            params.set('date_to', customDateTo);
        } else if (viewMode === 'monthly') {
            if (cutoffMode) {
                params.set('cutoff_month', selectedMonth);
            } else {
                params.set('month', selectedMonth);
            }
        } else {
            params.set('year', String(selectedYear));
        }
        if (selectedEmployees.length > 0) params.set('employee_ids', selectedEmployees.join(','));
        if (selectedDept) params.set('department_id', selectedDept);
        return `${API_BASE}/attendance_report.php?${params.toString()}`;
    }, [viewMode, selectedMonth, selectedYear, selectedEmployees, selectedDept, cutoffMode, customDateFrom, customDateTo]);

    const { data, loading, refetch: refetchReport } = useApi<ReportData>(() => fetch(apiUrl, { headers: getAuthHeaders() }).then(r => r.json()), [apiUrl]);

    const report = data?.employees || [];
    const summary = data?.summary;
    const leaveTypes = data?.leave_types || [];
    const departmentList = data?.departments || [];

    // Split leave types: main 3 (annual/sick/business) + others
    const MAIN_LEAVE_TYPES = ['annual', 'sick', 'business'];
    const { mainLeaves, otherLeaveIds } = useMemo(() => {
        const main = leaveTypes.filter((lt: any) => MAIN_LEAVE_TYPES.includes(lt.type));
        const otherIds = leaveTypes.filter((lt: any) => !MAIN_LEAVE_TYPES.includes(lt.type)).map((lt: any) => lt.id);
        return { mainLeaves: main, otherLeaveIds: otherIds };
    }, [leaveTypes]);

    // Full employee list (independent of report filter — needed for multi-select picker)
    const { data: allEmployeesData } = useApi<any[]>(() => getEmployees(), []);
    const allEmployees = useMemo(() => {
        return (allEmployeesData || []).map((e: any) => ({
            id: e.id,
            name: e.name,
            department: e.department_name || e.department || '',
        }));
    }, [allEmployeesData]);

    // Filtered employee list for picker search
    const filteredEmployees = useMemo(() => {
        const q = empSearch.trim().toLowerCase();
        if (!q) return allEmployees;
        return allEmployees.filter(emp =>
            emp.name.toLowerCase().includes(q) ||
            emp.id.toLowerCase().includes(q) ||
            (emp.department && emp.department.toLowerCase().includes(q))
        );
    }, [allEmployees, empSearch]);

    const toggleEmployee = useCallback((id: string) => {
        setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }, []);

    // Close picker on outside click
    useEffect(() => {
        if (!empPickerOpen) return;
        const handler = (e: MouseEvent) => {
            if (empPickerRef.current && !empPickerRef.current.contains(e.target as Node)) {
                setEmpPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [empPickerOpen]);

    // CSV export URL (summary)
    const csvUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (viewMode === 'custom') {
            params.set('date_from', customDateFrom);
            params.set('date_to', customDateTo);
        } else if (viewMode === 'monthly') {
            if (cutoffMode) {
                params.set('cutoff_month', selectedMonth);
            } else {
                params.set('month', selectedMonth);
            }
        } else {
            params.set('year', String(selectedYear));
        }
        if (selectedEmployees.length > 0) params.set('employee_ids', selectedEmployees.join(','));
        if (selectedDept) params.set('department_id', selectedDept);
        params.set('export', 'csv');
        return `${API_BASE}/attendance_report.php?${params.toString()}`;
    }, [viewMode, selectedMonth, selectedYear, selectedEmployees, selectedDept, cutoffMode, customDateFrom, customDateTo]);

    // CSV export URL (daily detail)
    const csvDailyUrl = useMemo(() => {
        if (viewMode !== 'monthly' && viewMode !== 'custom') return '';
        const params = new URLSearchParams();
        if (viewMode === 'custom') {
            params.set('date_from', customDateFrom);
            params.set('date_to', customDateTo);
        } else if (cutoffMode) {
            params.set('cutoff_month', selectedMonth);
        } else {
            params.set('month', selectedMonth);
        }
        if (selectedEmployees.length > 0) params.set('employee_ids', selectedEmployees.join(','));
        if (selectedDept) params.set('department_id', selectedDept);
        params.set('export', 'csv_daily');
        return `${API_BASE}/attendance_report.php?${params.toString()}`;
    }, [viewMode, selectedMonth, selectedEmployees, selectedDept, cutoffMode, customDateFrom, customDateTo]);

    // Export dropdown state
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Fetch daily detail when an employee is selected.
    // Uses modal-local date range if set; otherwise falls back to outer filter.
    const fetchDetailData = useCallback((silent = false) => {
        if (!detailEmpId) return;
        if (!silent) setDetailLoading(true);
        let dateParam: string;
        if (detailDateFrom && detailDateTo) {
            dateParam = `date_from=${detailDateFrom}&date_to=${detailDateTo}`;
        } else if (viewMode === 'custom') {
            dateParam = `date_from=${customDateFrom}&date_to=${customDateTo}`;
        } else if (viewMode === 'monthly') {
            dateParam = cutoffMode ? `cutoff_month=${selectedMonth}` : `month=${selectedMonth}`;
        } else {
            // yearly fallback — pick the year's full range
            dateParam = `date_from=${selectedYear}-01-01&date_to=${selectedYear}-12-31`;
        }
        fetch(`${API_BASE}/attendance_report.php?action=daily&${dateParam}&employee_id=${detailEmpId}`, { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(d => { setDetailData(d); if (!silent) setDetailLoading(false); })
            .catch(() => { if (!silent) setDetailLoading(false); });
    }, [detailEmpId, selectedMonth, selectedYear, viewMode, cutoffMode, customDateFrom, customDateTo, detailDateFrom, detailDateTo]);

    useEffect(() => {
        setEditingDate(null);
        fetchDetailData();
    }, [fetchDetailData]);

    const handleSaveEdit = async (date: string) => {
        if (!detailEmpId) return;
        setIsSavingEdit(true);
        try {
            const res = await fetch(`${API_BASE}/attendance.php?action=admin_edit`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    target_employee_id: detailEmpId,
                    date,
                    clock_in: editClockIn || null,
                    clock_out: editClockOut || null,
                    admin_note: editAdminNote, // empty string => clear, content => save
                })
            });
            const d = await res.json();
            if (res.ok) {
                setEditingDate(null);
                fetchDetailData(true); // silent refresh
            } else {
                alert(d.error || 'Failed to update attendance');
            }
        } catch (e) {
            alert('Network error');
        } finally {
            setIsSavingEdit(false);
        }
    };

    // HR changes OT rate inline on an entry (excel-style, no modal)
    const handleChangeOtRate = useCallback(async (entryId: number, newRate: number) => {
        setOtRateUpdating(prev => ({ ...prev, [entryId]: true }));
        try {
            await updateOtRate(entryId, newRate);
            fetchDetailData(true);
            refetchReport(); // OT total on outer table may change
        } catch (e: any) {
            alert(e?.message || 'อัปเดตอัตรา OT ไม่สำเร็จ');
        } finally {
            setOtRateUpdating(prev => { const n = { ...prev }; delete n[entryId]; return n; });
        }
    }, [fetchDetailData, refetchReport]);

    // Get leave days for a specific type
    const getLeave = (row: ReportRow, typeId: number) => {
        const found = row.leave_by_type.find(l => l.leave_type_id === typeId);
        return found ? found.days : 0;
    };

    // Get total "other" leave days
    const getOtherLeave = (row: ReportRow) => {
        return row.leave_by_type
            .filter(l => otherLeaveIds.includes(l.leave_type_id))
            .reduce((sum, l) => sum + l.days, 0);
    };

    // Years for dropdown
    const yearOptions = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 3; y--) yearOptions.push(y);

    // Month label in Thai
    const monthLabel = (m: string) => {
        const d = new Date(m + '-01');
        return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    };

    // Cutoff period label: "21 มี.ค. - 20 เม.ย. 2569"
    const cutoffLabel = (m: string) => {
        const [y, mon] = m.split('-').map(Number);
        const prevMonth = mon === 1 ? 12 : mon - 1;
        const prevYear = mon === 1 ? y - 1 : y;
        const start = new Date(prevYear, prevMonth - 1, 21);
        const end = new Date(y, mon - 1, 20);
        const fmt = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${fmt(start)} — ${fmt(end)}`;
    };

    // Format time
    const fmtTime = (t: string | null) => t ? t.substring(0, 5) : '-';

    // Compute the date range that the outer filter would produce
    const outerDateRange = useMemo(() => {
        if (viewMode === 'custom') {
            return { from: customDateFrom, to: customDateTo };
        }
        if (viewMode === 'monthly') {
            const [y, m] = selectedMonth.split('-').map(Number);
            if (cutoffMode) {
                // 21st of prev month → 20th of current month
                const prevM = m === 1 ? 12 : m - 1;
                const prevY = m === 1 ? y - 1 : y;
                return {
                    from: `${prevY}-${String(prevM).padStart(2, '0')}-21`,
                    to: `${y}-${String(m).padStart(2, '0')}-20`,
                };
            }
            const lastDay = new Date(y, m, 0).getDate();
            return {
                from: `${y}-${String(m).padStart(2, '0')}-01`,
                to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
            };
        }
        return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    }, [viewMode, selectedMonth, selectedYear, cutoffMode, customDateFrom, customDateTo]);

    // Leave types ordered + annotated with employee's remaining quota
    const leaveTypeChoices = useMemo(() => {
        const types = (allLeaveTypes || []).filter((lt: any) => lt.is_active);
        return types.map((lt: any) => {
            const quota = (recLeaveQuotas || []).find((q: any) => Number(q.leave_type_id) === Number(lt.id));
            const remaining = quota ? Number(quota.remaining) : null;
            const isUnlimited = remaining === -1;
            const label = isUnlimited
                ? `${lt.name} (ไม่จำกัด)`
                : remaining === null
                    ? lt.name
                    : `${lt.name} (เหลือ ${remaining} วัน)`;
            return { id: lt.id, name: lt.name, label, remaining, isUnlimited };
        });
    }, [allLeaveTypes, recLeaveQuotas]);

    // Auto-compute total_days from date range (multi-day = calendar days; same-day = 1)
    const recLeaveCalcDays = useMemo(() => {
        if (!recLeaveStartDate || !recLeaveEndDate) return 0;
        const s = new Date(recLeaveStartDate);
        const e = new Date(recLeaveEndDate);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
        if (s > e) return 0;
        const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    }, [recLeaveStartDate, recLeaveEndDate]);

    const [recLeaveDays, setRecLeaveDays] = useState<string>('1');
    // Auto-update days input whenever date range changes (admin can still override)
    useEffect(() => {
        if (recLeaveCalcDays > 0) setRecLeaveDays(String(recLeaveCalcDays));
    }, [recLeaveCalcDays]);

    const openRecordLeave = useCallback((emp: { id: string; name: string }, presetDate?: string) => {
        setRecordLeaveFor(emp);
        setRecLeaveTypeId('');
        setRecLeaveReason('');
        if (presetDate) {
            setRecLeaveStartDate(presetDate);
            setRecLeaveEndDate(presetDate);
            setRecLeaveDays('1');
        } else {
            const today = toDateStr(new Date());
            setRecLeaveStartDate(today);
            setRecLeaveEndDate(today);
            setRecLeaveDays('1');
        }
    }, []);

    const closeRecordLeave = useCallback(() => {
        setRecordLeaveFor(null);
    }, []);

    const handleSubmitRecordLeave = useCallback(async () => {
        if (!recordLeaveFor) return;
        if (!recLeaveTypeId) { alert('กรุณาเลือกประเภทการลา'); return; }
        if (!recLeaveStartDate || !recLeaveEndDate) { alert('กรุณาเลือกวันที่'); return; }
        const days = parseFloat(recLeaveDays);
        if (isNaN(days) || days <= 0) { alert('จำนวนวันต้องมากกว่า 0'); return; }
        if (!recLeaveReason.trim()) { alert('กรุณาใส่เหตุผล'); return; }

        const choice = leaveTypeChoices.find(c => String(c.id) === recLeaveTypeId);
        if (choice && !choice.isUnlimited && choice.remaining !== null && days > choice.remaining) {
            if (!confirm(`โควต้า "${choice.name}" เหลือ ${choice.remaining} วัน — ขอ ${days} วัน. ต้องการบันทึกหรือไม่?`)) return;
        }

        setRecLeaveSubmitting(true);
        try {
            await createLeaveRequestAsAdmin({
                employee_id: recordLeaveFor.id,
                leave_type_id: parseInt(recLeaveTypeId),
                start_date: recLeaveStartDate,
                end_date: recLeaveEndDate,
                total_days: days,
                reason: `[HR บันทึกแทน] ${recLeaveReason.trim()}`,
            });
            closeRecordLeave();
            // Refresh report to reflect deducted quota / leave count
            refetchReport();
            // Also refetch detail if open
            if (detailEmpId === recordLeaveFor.id) fetchDetailData(true);
        } catch (e: any) {
            alert(e?.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setRecLeaveSubmitting(false);
        }
    }, [recordLeaveFor, recLeaveTypeId, recLeaveStartDate, recLeaveEndDate, recLeaveDays, recLeaveReason, leaveTypeChoices, closeRecordLeave, refetchReport, detailEmpId, fetchDetailData]);

    // ── PDF export (one PDF per employee, bundled as ZIP) ──
    const periodSlug = useMemo(() => {
        if (viewMode === 'custom') return `${customDateFrom}_to_${customDateTo}`;
        if (viewMode === 'monthly') return cutoffMode ? `cutoff-${selectedMonth}` : selectedMonth;
        return String(selectedYear);
    }, [viewMode, selectedMonth, selectedYear, cutoffMode, customDateFrom, customDateTo]);

    const periodLabelText = useMemo(() => {
        if (viewMode === 'custom') return `${formatThaiDate(customDateFrom)} — ${formatThaiDate(customDateTo)}`;
        if (viewMode === 'monthly') return cutoffMode ? cutoffLabel(selectedMonth) : monthLabel(selectedMonth);
        return `ปี ${selectedYear + 543}`;
    }, [viewMode, selectedMonth, selectedYear, cutoffMode, customDateFrom, customDateTo]);

    // Build the date-range query the daily endpoint expects
    const dailyDateParam = useMemo(() => {
        if (viewMode === 'custom') return `date_from=${customDateFrom}&date_to=${customDateTo}`;
        if (viewMode === 'monthly') return cutoffMode ? `cutoff_month=${selectedMonth}` : `month=${selectedMonth}`;
        return `date_from=${selectedYear}-01-01&date_to=${selectedYear}-12-31`;
    }, [viewMode, selectedMonth, selectedYear, cutoffMode, customDateFrom, customDateTo]);

    // Export each employee's daily report as a real PDF (server-side mPDF render),
    // bundled into a ZIP. Backend endpoint /api/attendance_pdf.php produces vector
    // PDFs with embedded Sarabun font — crisp text + proper Thai diacritics. HR
    // gets ZIP of .pdf files ready to attach in chat / email.
    const exportPdfZip = useCallback(async () => {
        if (!report || report.length === 0) {
            alert('ไม่มีข้อมูลพนักงานให้ export');
            return;
        }
        if (!confirm(`Export PDF จำนวน ${report.length} ไฟล์ (รวมเป็น ZIP)?`)) return;

        setShowExportMenu(false);
        const targets = report;
        setPdfProgress({ current: 0, total: targets.length });
        const zip = new JSZip();

        try {
            // Fetch PDF blobs in parallel batches of 3 (PDF render is heavier than JSON)
            const batchSize = 3;
            for (let i = 0; i < targets.length; i += batchSize) {
                const batch = targets.slice(i, i + batchSize);
                const results = await Promise.all(batch.map(async emp => {
                    try {
                        const res = await fetch(
                            `${API_BASE}/attendance_pdf.php?${dailyDateParam}&employee_id=${emp.employee_id}`,
                            { headers: getAuthHeaders() }
                        );
                        if (!res.ok) return null;
                        const blob = await res.blob();
                        return { emp, blob };
                    } catch { return null; }
                }));
                results.forEach(r => {
                    if (!r) return;
                    const safeName = (r.emp.employee_name || r.emp.employee_id).replace(/[^\w฀-๿\s.-]/g, '').trim() || r.emp.employee_id;
                    zip.file(`${r.emp.employee_id}_${safeName}.pdf`, r.blob);
                });
                setPdfProgress({ current: Math.min(i + batchSize, targets.length), total: targets.length });
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `attendance_${periodSlug}.zip`);
        } catch (err: any) {
            alert(`Export ไม่สำเร็จ: ${err?.message || err}`);
        } finally {
            setPdfProgress(null);
        }
    }, [report, periodSlug, dailyDateParam]);

    // Preview ALL employees' daily reports as a NATIVE HTML page in a new tab.
    // User hits Ctrl+P / Cmd+P → Save as PDF. Text/borders render at native browser
    // quality (vector + crisp), not rasterized — Thai diacritics & หัว stay sharp.
    const previewPdfAll = useCallback(async () => {
        if (!report || report.length === 0) {
            alert('ไม่มีข้อมูลพนักงานให้พรีวิว');
            return;
        }
        setShowExportMenu(false);
        const targets = report;
        setPdfProgress({ current: 0, total: targets.length });

        try {
            // Fetch daily detail for every employee in parallel batches of 5
            // to avoid overwhelming the server.
            const allDaily: { emp: ReportRow; daily: DailyData }[] = [];
            const batchSize = 5;
            for (let i = 0; i < targets.length; i += batchSize) {
                const batch = targets.slice(i, i + batchSize);
                const results = await Promise.all(batch.map(async emp => {
                    try {
                        const res = await fetch(
                            `${API_BASE}/attendance_report.php?action=daily&${dailyDateParam}&employee_id=${emp.employee_id}`,
                            { headers: getAuthHeaders() }
                        );
                        return { emp, daily: await res.json() as DailyData };
                    } catch {
                        return null;
                    }
                }));
                results.forEach(r => { if (r && r.daily?.days) allDaily.push(r); });
                setPdfProgress({ current: Math.min(i + batchSize, targets.length), total: targets.length });
            }

            // Build self-contained HTML and open in new tab
            const html = buildPrintableReportHtml(allDaily, periodLabelText);
            const win = window.open('', '_blank');
            if (!win) {
                alert('เบราว์เซอร์บล็อก popup — กรุณาอนุญาต popup สำหรับเว็บนี้');
                return;
            }
            win.document.open();
            win.document.write(html);
            win.document.close();
            // Trigger the print dialog automatically after the page finishes loading
            // (fonts ready ensures Sarabun is fully loaded before printing).
            const triggerPrint = () => {
                try {
                    if ((win.document as any).fonts?.ready) {
                        (win.document as any).fonts.ready.then(() => {
                            setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 300);
                        });
                    } else {
                        setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 800);
                    }
                } catch {}
            };
            if (win.document.readyState === 'complete') triggerPrint();
            else win.addEventListener('load', triggerPrint);
        } catch (err: any) {
            alert(`พรีวิวไม่สำเร็จ: ${err?.message || err}`);
        } finally {
            setPdfProgress(null);
        }
    }, [report, dailyDateParam, periodLabelText]);

    // Open daily detail — seed modal-local dates from outer filter
    const openDetail = (empId: string) => {
        setDetailDateFrom(outerDateRange.from);
        setDetailDateTo(outerDateRange.to);
        setDetailEmpId(empId);
        setDetailData(null);
    };

    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1800px] mx-auto min-h-full">
            {/* Header */}
            {/* Header + Export */}
            <header className="mb-6 flex items-start gap-3">
                <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">รายงานเข้างาน</h1>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">สรุปการมาทำงาน สาย ลา OT เบี้ยขยัน • กดที่ชื่อพนักงานเพื่อดูรายวัน</p>
                </div>
                {/* Export CSV — top right corner */}
                <div className="relative flex-shrink-0">
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold shadow-sm transition-colors"
                    >
                        <span className="material-icons-round text-base">download</span>
                        <span className="hidden sm:inline">Export CSV</span>
                        <span className="material-icons-round text-base">{showExportMenu ? 'expand_less' : 'expand_more'}</span>
                    </button>
                    {showExportMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 min-w-[220px] overflow-hidden">
                                <a href={csvUrl} download onClick={() => setShowExportMenu(false)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm text-gray-700 dark:text-gray-200">
                                    <span className="material-icons-round text-green-500 text-lg">summarize</span>
                                    <div>
                                        <div className="font-semibold">สรุปรายบุคคล</div>
                                        <div className="text-xs text-gray-400">สรุป มา/สาย/ขาด/ลา/OT</div>
                                    </div>
                                </a>
                                <button
                                    type="button"
                                    onClick={previewPdfAll}
                                    disabled={pdfProgress !== null}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700 disabled:opacity-50"
                                >
                                    <span className="material-icons-round text-red-500 text-lg">picture_as_pdf</span>
                                    <div className="text-left">
                                        <div className="font-semibold">พรีวิว PDF (รวมทุกคน)</div>
                                        <div className="text-xs text-gray-400">เปิดดูในแท็บใหม่ — กด Save / Print เองได้</div>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={exportPdfZip}
                                    disabled={pdfProgress !== null}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700 disabled:opacity-50"
                                >
                                    <span className="material-icons-round text-purple-600 text-lg">folder_zip</span>
                                    <div className="text-left">
                                        <div className="font-semibold">PDF ละคน (ZIP)</div>
                                        <div className="text-xs text-gray-400">1 ไฟล์ .pdf / พนักงาน — ส่งทางแชท/อีเมลได้เลย</div>
                                    </div>
                                </button>
                                {viewMode === 'monthly' && (
                                    <>
                                        <a href={csvDailyUrl} download onClick={() => setShowExportMenu(false)}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700">
                                            <span className="material-icons-round text-blue-500 text-lg">calendar_month</span>
                                            <div>
                                                <div className="font-semibold">รายวันละเอียด (ทั้งเดือน)</div>
                                                <div className="text-xs text-gray-400">เข้า-ออก ทุกวัน ทุกคน</div>
                                            </div>
                                        </a>
                                        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/80">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="material-icons-round text-primary text-lg">event</span>
                                                <div className="font-semibold text-sm text-gray-700 dark:text-gray-200">รายวัน (เฉพาะวัน)</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
                                                    onClick={(e) => e.stopPropagation()} />
                                                <a href={`${API_BASE}/attendance_report.php?export=csv_specific_day&date=${selectedDate}${selectedEmployees.length > 0 ? `&employee_ids=${selectedEmployees.join(',')}` : ''}${selectedDept ? `&department_id=${selectedDept}` : ''}`}
                                                    download onClick={() => setShowExportMenu(false)}
                                                    className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap">
                                                    Export
                                                </a>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* Filters — single row */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-3 mb-6">
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* View Mode */}
                    <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                        <button onClick={() => setViewMode('monthly')}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'monthly' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}>
                            รายเดือน
                        </button>
                        <button onClick={() => setViewMode('yearly')}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'yearly' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}>
                            รายปี
                        </button>
                    </div>

                    {/* Cutoff Toggle */}
                    {viewMode === 'monthly' && (
                        <button onClick={() => setCutoffMode(!cutoffMode)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${cutoffMode
                                ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300'
                                : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            title="ตัดรอบวันที่ 20 (21 เดือนก่อน - 20 เดือนที่เลือก)">
                            <span className="material-icons-round text-[14px]">{cutoffMode ? 'event_repeat' : 'date_range'}</span>
                            ตัดรอบ 20
                        </button>
                    )}

                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 hidden md:block" />

                    {/* Month / Year (only when not custom) */}
                    {viewMode === 'monthly' ? (
                        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                    ) : viewMode === 'yearly' ? (
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none">
                            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                        </select>
                    ) : null}

                    {/* ═══ Custom Date Range Button ═══ */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setTempDateFrom(customDateFrom);
                                setTempDateTo(customDateTo);
                                setShowDateRangePicker(!showDateRangePicker);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                viewMode === 'custom'
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span className="material-icons-round text-[14px]">calendar_today</span>
                            {viewMode === 'custom'
                                ? `${formatThaiDate(customDateFrom)} — ${formatThaiDate(customDateTo)}`
                                : 'ระบุวันที่ต้องการเลือก'}
                        </button>

                        {/* ═══ Date Range Picker Popup ═══ */}
                        {showDateRangePicker && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowDateRangePicker(false)} />
                                <div className="absolute left-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 w-[340px] overflow-hidden animate-scale-in">
                                    {/* Popup Header */}
                                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <span className="material-icons-round text-primary text-lg">date_range</span>
                                            ระบุช่วงวันที่
                                        </h3>
                                    </div>

                                    {/* Date Inputs */}
                                    <div className="px-4 pt-3 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">จากวันที่</label>
                                                <input
                                                    type="date"
                                                    value={tempDateFrom}
                                                    onChange={e => setTempDateFrom(e.target.value)}
                                                    className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <span className="text-gray-400 mt-4">→</span>
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">ถึงวันที่</label>
                                                <input
                                                    type="date"
                                                    value={tempDateTo}
                                                    onChange={e => setTempDateTo(e.target.value)}
                                                    className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Range Buttons */}
                                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">เลือกด่วน</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {QUICK_RANGES.map((qr) => {
                                                const [qFrom, qTo] = qr.getRange();
                                                const isActive = tempDateFrom === qFrom && tempDateTo === qTo;
                                                return (
                                                    <button
                                                        key={qr.label}
                                                        onClick={() => {
                                                            setTempDateFrom(qFrom);
                                                            setTempDateTo(qTo);
                                                        }}
                                                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                                                            isActive
                                                                ? 'bg-primary/10 text-primary border border-primary/30 dark:bg-primary/20'
                                                                : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                                                        }`}
                                                    >
                                                        <span className={`material-icons-round text-[14px] ${isActive ? 'text-primary' : 'text-gray-400'}`}>{qr.icon}</span>
                                                        {qr.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Apply / Cancel */}
                                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                                        <button
                                            onClick={() => setShowDateRangePicker(false)}
                                            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (tempDateFrom > tempDateTo) {
                                                    // Swap if from > to
                                                    setCustomDateFrom(tempDateTo);
                                                    setCustomDateTo(tempDateFrom);
                                                } else {
                                                    setCustomDateFrom(tempDateFrom);
                                                    setCustomDateTo(tempDateTo);
                                                }
                                                setViewMode('custom');
                                                setShowDateRangePicker(false);
                                            }}
                                            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-primary hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span className="material-icons-round text-sm">check</span>
                                            ใช้ช่วงวันที่นี้
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 hidden md:block" />

                    {/* Department */}
                    <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none">
                        <option value="">ทุกแผนก</option>
                        {departmentList.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                    </select>

                    {/* Employee Multi-Select */}
                    <div className="relative" ref={empPickerRef}>
                        <button type="button" onClick={() => setEmpPickerOpen(o => !o)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white hover:border-primary/40 focus:ring-2 focus:ring-primary/30 focus:outline-none min-w-[140px]">
                            <span className="material-icons-round text-[14px] text-gray-400">people</span>
                            <span className="truncate">
                                {selectedEmployees.length === 0
                                    ? 'ทุกคน'
                                    : selectedEmployees.length === 1
                                        ? (allEmployees.find(e => e.id === selectedEmployees[0])?.name || '1 คน')
                                        : `เลือกแล้ว ${selectedEmployees.length} คน`}
                            </span>
                            <span className="material-icons-round text-[14px] text-gray-400 ml-auto">{empPickerOpen ? 'expand_less' : 'expand_more'}</span>
                        </button>
                        {empPickerOpen && (
                            <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden flex flex-col max-h-[400px]">
                                {/* Search */}
                                <div className="p-2 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                                    <div className="relative">
                                        <span className="material-icons-round absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-base">search</span>
                                        <input type="text" autoFocus value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                                            placeholder="ค้นหาชื่อ / รหัส / แผนก..."
                                            className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                                    </div>
                                    {selectedEmployees.length > 0 && (
                                        <div className="flex items-center justify-between mt-2 text-[11px]">
                                            <span className="text-gray-500">เลือก {selectedEmployees.length} คน</span>
                                            <button onClick={() => setSelectedEmployees([])} className="text-red-500 hover:underline">ล้างทั้งหมด</button>
                                        </div>
                                    )}
                                </div>
                                {/* List */}
                                <div className="flex-1 overflow-y-auto">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="text-center py-6 text-xs text-gray-400">ไม่พบพนักงาน</div>
                                    ) : (
                                        filteredEmployees.map(emp => {
                                            const checked = selectedEmployees.includes(emp.id);
                                            return (
                                                <label key={emp.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${checked ? 'bg-primary/5' : ''}`}>
                                                    <input type="checkbox" checked={checked} onChange={() => toggleEmployee(emp.id)} className="w-4 h-4 accent-primary" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{emp.name}</div>
                                                        <div className="text-[10px] text-gray-400 truncate">{emp.id} • {emp.department || '-'}</div>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Custom range period label — right side */}
                    {viewMode === 'custom' && (
                        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                            <span className="material-icons-round text-blue-500 text-[14px]">date_range</span>
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                {formatThaiDate(customDateFrom)} — {formatThaiDate(customDateTo)}
                            </span>
                            <button onClick={() => setViewMode('monthly')} className="ml-1 text-blue-400 hover:text-blue-600 transition-colors" title="กลับไปโหมดรายเดือน">
                                <span className="material-icons-round text-[14px]">close</span>
                            </button>
                        </div>
                    )}

                    {/* Cutoff period label — right side */}
                    {cutoffMode && viewMode === 'monthly' && (
                        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                            <span className="material-icons-round text-amber-500 text-[14px]">date_range</span>
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">{cutoffLabel(selectedMonth)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {summary && !loading && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                    {[
                        { label: 'พนักงาน', value: summary.total_employees, unit: 'คน', icon: 'people', color: 'blue' },
                        { label: 'ขาดงาน', value: summary.total_absent_days, unit: 'วัน', icon: 'event_busy', color: 'red' },
                        { label: 'สาย', value: summary.total_late_count, unit: 'ครั้ง', icon: 'alarm', color: 'orange' },
                        { label: 'สายรวม', value: summary.total_late_minutes, unit: '', icon: 'timer', color: 'amber', isMinutesTime: true },
                        { label: 'ลารวม', value: summary.total_leave_days, unit: 'วัน', icon: 'beach_access', color: 'purple' },
                        { label: 'OT', value: summary.total_ot_hours, unit: '', icon: 'more_time', color: 'cyan', isTime: true },
                        { label: 'เบี้ยขยัน', value: summary.diligence_eligible_count, unit: 'คน', icon: 'emoji_events', color: 'green' },
                    ].map((s, i) => {
                        return (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center overflow-hidden">
                                <span className={`material-icons-round text-${s.color}-500 text-xl mb-1 block`}>{s.icon}</span>
                                <p className={`font-bold text-gray-900 dark:text-white truncate ${(s.isTime || s.isMinutesTime) ? 'text-sm' : 'text-lg'}`} title={String(s.value)}>
                                    {s.isTime ? formatTimeDuration(s.value) : s.isMinutesTime ? formatMinutesDuration(s.value) : formatNum(s.value)}
                                </p>
                                <p className="text-[10px] text-gray-500">{s.label} {s.unit && <span className="text-gray-400">({s.unit})</span>}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white">
                        {viewMode === 'custom'
                            ? `${formatThaiDate(customDateFrom)} — ${formatThaiDate(customDateTo)}`
                            : viewMode === 'monthly'
                            ? (cutoffMode ? cutoffLabel(selectedMonth) : monthLabel(selectedMonth))
                            : `ปี ${selectedYear + 543}`}
                        {selectedEmployees.length === 1 && ` — ${report[0]?.employee_name || ''}`}
                        {selectedEmployees.length > 1 && ` — ${selectedEmployees.length} คน`}
                    </h3>
                    <span className="text-xs text-gray-400">
                        วันทำงาน (ถึงวันนี้): {data?.expected_work_days ?? '-'} วัน
                        {data?.full_period_work_days !== data?.expected_work_days && (
                            <span className="ml-1">(ทั้งเดือน: {data?.full_period_work_days} วัน)</span>
                        )}
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                ) : report.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">assignment</span>
                        <p className="text-gray-500 font-medium">ไม่มีข้อมูล</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider whitespace-nowrap">
                                    <th className="px-2 py-2.5 font-semibold sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">พนักงาน</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">แผนก</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">มา<br />ทำงาน</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">ขาด</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">สาย<br />(ครั้ง)</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">สาย<br />(เวลา)</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">กลับก่อน<br />(ครั้ง)</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">กลับก่อน<br />(เวลา)</th>
                                    {mainLeaves.map((lt: any) => (
                                        <th key={lt.id} className="px-2 py-2.5 font-semibold text-center">{lt.name}</th>
                                    ))}
                                    {otherLeaveIds.length > 0 && (
                                        <th className="px-2 py-2.5 font-semibold text-center">ลา<br />อื่นๆ</th>
                                    )}
                                    <th className="px-2 py-2.5 font-semibold text-center">ลา<br />รวม</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">OT</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">รวม<br />เวลาทำงาน</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">เบี้ย<br />ขยัน</th>
                                    <th className="px-2 py-2.5 font-semibold text-center">คีย์<br />ลา</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {report.map(row => (
                                    <tr
                                        key={row.employee_id}
                                        onClick={() => openDetail(row.employee_id)}
                                        className={`hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-sm ${viewMode === 'monthly' || viewMode === 'custom' ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className="px-2 py-2.5 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                            <div className="flex items-center gap-1">
                                                <div>
                                                    <p className="font-semibold text-primary text-xs underline decoration-dotted underline-offset-2 whitespace-nowrap">{row.employee_name}</p>
                                                    <p className="text-[10px] text-gray-400">{row.employee_id}</p>
                                                </div>
                                                {(viewMode === 'monthly' || viewMode === 'custom') && (
                                                    <span className="material-icons-round text-gray-300 text-sm">chevron_right</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2.5 text-center text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.department}</td>
                                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                            <span className="font-semibold text-gray-900 dark:text-white">{row.actual_work_days}</span>
                                            <span className="text-[10px] text-gray-400">/{row.expected_work_days}</span>
                                        </td>
                                        <td className={`px-2 py-2.5 text-center font-semibold ${row.absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {formatNum(row.absent_days)}
                                        </td>
                                        <td className={`px-2 py-2.5 text-center font-semibold ${row.late_count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                            {formatNum(row.late_count)}
                                        </td>
                                        <td className={`px-2 py-2.5 text-center text-xs ${row.late_minutes_total > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                                            {row.late_minutes_total > 0 ? formatMinutesDuration(row.late_minutes_total) : '-'}
                                        </td>
                                        <td className={`px-2 py-2.5 text-center font-semibold ${row.early_leave_count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                            {formatNum(row.early_leave_count || 0)}
                                        </td>
                                        <td className={`px-2 py-2.5 text-center text-xs ${row.early_leave_minutes_total > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                                            {row.early_leave_minutes_total > 0 ? formatMinutesDuration(row.early_leave_minutes_total) : '-'}
                                        </td>
                                        {mainLeaves.map((lt: any) => {
                                            const days = getLeave(row, lt.id);
                                            return (
                                                <td key={lt.id} className={`px-2 py-2.5 text-center text-xs ${days > 0 ? 'text-purple-600 font-semibold' : 'text-gray-400'}`}>
                                                    {days > 0 ? formatNum(days) : '-'}
                                                </td>
                                            );
                                        })}
                                        {otherLeaveIds.length > 0 && (() => {
                                            const otherDays = getOtherLeave(row);
                                            return (
                                                <td className={`px-2 py-2.5 text-center text-xs ${otherDays > 0 ? 'text-purple-600 font-semibold' : 'text-gray-400'}`}>
                                                    {otherDays > 0 ? formatNum(otherDays) : '-'}
                                                </td>
                                            );
                                        })()}
                                        <td className={`px-2 py-2.5 text-center font-semibold ${row.total_leave_days > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                            {formatNum(row.total_leave_days)}
                                        </td>
                                        <td className={`px-2 py-2.5 text-center font-semibold ${row.ot_hours > 0 ? 'text-cyan-600' : 'text-gray-400'}`}>
                                            {formatTimeDuration(row.ot_hours)}
                                        </td>
                                        <td className="px-2 py-2.5 text-center text-xs text-gray-600 dark:text-gray-300">
                                            {formatTimeDuration(row.total_work_hours)}
                                        </td>
                                        <td className="px-2 py-2.5 text-center">
                                            {row.diligence_eligible ? (
                                                <span className="material-icons-round text-base text-green-500" title="ได้เบี้ยขยัน">check_circle</span>
                                            ) : (
                                                <span className="material-icons-round text-base text-red-400" title="ไม่ได้เบี้ยขยัน">cancel</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2.5 text-center">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openRecordLeave({ id: row.employee_id, name: row.employee_name }); }}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40 text-[11px] font-semibold transition-colors"
                                                title="HR คีย์การลาให้พนักงานคนนี้"
                                            >
                                                <span className="material-icons-round text-[14px]">add_circle</span>
                                                ลา
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mobile Card View (for small screens) */}
            <div className="md:hidden mt-4 space-y-3">
                {!loading && report.map(row => (
                    <div
                        key={row.employee_id}
                        onClick={() => openDetail(row.employee_id)}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 active:bg-gray-50 dark:active:bg-gray-700 cursor-pointer"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h4 className="font-bold text-primary text-sm">{row.employee_name} <span className="material-icons-round text-xs text-gray-300 align-middle">chevron_right</span></h4>
                                <p className="text-[11px] text-gray-500">{row.department} • {row.employee_id}</p>
                            </div>
                            {row.diligence_eligible ? (
                                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center gap-1">
                                    <span className="material-icons-round text-xs">emoji_events</span> เบี้ยขยัน
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">ไม่ได้เบี้ยขยัน</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                                <p className="font-bold text-blue-700 dark:text-blue-300">{row.actual_work_days}/{row.expected_work_days}</p>
                                <p className="text-[10px] text-gray-500">มาทำงาน</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.absent_days > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatNum(row.absent_days)}</p>
                                <p className="text-[10px] text-gray-500">ขาด</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.late_count > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.late_count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{formatNum(row.late_count)} <span className="font-normal text-[10px]">({row.late_minutes_total > 0 ? formatMinutesDuration(row.late_minutes_total) : '-'})</span></p>
                                <p className="text-[10px] text-gray-500">สาย</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.total_leave_days > 0 ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.total_leave_days > 0 ? 'text-purple-600' : 'text-gray-400'}`}>{formatNum(row.total_leave_days)}</p>
                                <p className="text-[10px] text-gray-500">ลา (วัน)</p>
                            </div>
                            <div className={`rounded-lg p-2 ${row.ot_hours > 0 ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                <p className={`font-bold ${row.ot_hours > 0 ? 'text-cyan-600' : 'text-gray-400'}`}>{formatTimeDuration(row.ot_hours)}</p>
                                <p className="text-[10px] text-gray-500">OT</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
                                <p className="font-bold text-gray-600 dark:text-gray-300">{formatTimeDuration(row.total_work_hours)}</p>
                                <p className="text-[10px] text-gray-500">รวมเวลา</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openRecordLeave({ id: row.employee_id, name: row.employee_name }); }}
                            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 text-xs font-semibold transition-colors"
                        >
                            <span className="material-icons-round text-base">add_circle</span>
                            HR คีย์การลาให้คนนี้
                        </button>
                    </div>
                ))}
            </div>

            {/* ═══ DAILY DETAIL MODAL ═══ */}
            {detailEmpId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDetailEmpId(null)}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                        📅 รายวัน — {detailData?.employee_name || '...'}
                                    </h2>
                                    <p className="text-xs text-gray-500 truncate">
                                        {detailData?.department} • เข้างาน {fmtTime(detailData?.work_start_time || null)} – ออกงาน {fmtTime(detailData?.work_end_time || null)}
                                    </p>
                                </div>
                                <button onClick={() => setDetailEmpId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 shrink-0">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                            {/* Modal-local date range picker */}
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-gray-500 font-semibold">ช่วงวันที่:</span>
                                <input type="date" value={detailDateFrom} max={detailDateTo || undefined}
                                    onChange={e => setDetailDateFrom(e.target.value)}
                                    className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                                <span className="text-gray-400">—</span>
                                <input type="date" value={detailDateTo} min={detailDateFrom || undefined}
                                    onChange={e => setDetailDateTo(e.target.value)}
                                    className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                                <button type="button"
                                    onClick={() => { setDetailDateFrom(outerDateRange.from); setDetailDateTo(outerDateRange.to); }}
                                    className="ml-auto px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1">
                                    <span className="material-icons-round text-[14px]">restart_alt</span>
                                    รีเซ็ตเป็นช่วงด้านนอก
                                </button>
                            </div>
                        </div>

                        {/* Modal Body — scrollable */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {detailLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                                </div>
                            ) : detailData ? (
                                <>
                                    {/* OT Summary Card */}
                                    {detailData.ot_entries && detailData.ot_entries.length > 0 && (() => {
                                        const totalHours = detailData.ot_entries.reduce((s, e) => s + (e.hours || 0), 0);
                                        return (
                                            <div className="mb-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40 bg-cyan-50/50 dark:bg-cyan-900/10 p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-icons-round text-cyan-600 dark:text-cyan-400 text-base">bolt</span>
                                                        <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">OT ในช่วงนี้</span>
                                                    </div>
                                                    <span className="text-xs text-cyan-700 dark:text-cyan-300 font-semibold">
                                                        {detailData.ot_entries.length} รายการ • รวม {formatTimeDuration(totalHours)}
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {detailData.ot_entries.map(e => {
                                                        const d = new Date(e.date);
                                                        const dateLabel = `${d.getDate()}/${d.getMonth() + 1} (${DOW_TH[((d.getDay() + 6) % 7) + 1]})`;
                                                        const updating = !!otRateUpdating[e.id];
                                                        return (
                                                            <div key={e.id} className="flex items-center gap-2 text-xs bg-white dark:bg-gray-800 rounded-lg px-2 py-1.5 border border-cyan-100/60 dark:border-cyan-900/30">
                                                                <span className="font-semibold text-gray-700 dark:text-gray-200 w-[68px]">{dateLabel}</span>
                                                                <span className="font-mono text-gray-500">{e.start_time}–{e.end_time}</span>
                                                                <span className="text-cyan-700 dark:text-cyan-300 font-semibold">{formatTimeDuration(e.hours)}</span>
                                                                <select
                                                                    value={Number(e.ot_rate).toFixed(1)}
                                                                    onChange={ev => handleChangeOtRate(e.id, parseFloat(ev.target.value))}
                                                                    disabled={updating}
                                                                    className="ml-auto px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                                                                    title="คลิกเพื่อเปลี่ยนอัตรา OT"
                                                                >
                                                                    <option value="1.0">×1.0</option>
                                                                    <option value="1.5">×1.5</option>
                                                                    <option value="2.0">×2.0</option>
                                                                    <option value="3.0">×3.0</option>
                                                                </select>
                                                                {e.status === 'pending' && (
                                                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-bold">รออนุมัติ</span>
                                                                )}
                                                                {e.status === 'rejected' && (
                                                                    <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[9px] font-bold">ปฏิเสธ</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[10px] text-cyan-600/70 dark:text-cyan-400/70 mt-2 leading-snug">
                                                    HR แก้อัตราได้ทันที (×1 / ×1.5 / ×2 / ×3) ระบบจะอัปเดตทั่วทั้งรายงาน
                                                </p>
                                            </div>
                                        );
                                    })()}

                                    {/* Legend */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {['present', 'late', 'leave', 'absent', 'holiday', 'weekend'].map(s => {
                                            const cfg = STATUS_CONFIG[s];
                                            return (
                                                <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                                                    <span className="material-icons-round text-xs">{cfg.icon}</span>
                                                    {cfg.label}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {/* Daily Table */}
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                                        <table className="w-full text-sm min-w-[720px]">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-800/80 text-[11px] text-gray-500 uppercase tracking-wider">
                                                    <th className="p-2 text-left font-semibold">วันที่</th>
                                                    <th className="p-2 text-center font-semibold">สถานะ</th>
                                                    <th className="p-2 text-center font-semibold">เข้า</th>
                                                    <th className="p-2 text-center font-semibold">ออก</th>
                                                    <th className="p-2 text-center font-semibold">เวลาทำงาน</th>
                                                    <th className="p-2 text-center font-semibold">OT</th>
                                                    <th className="p-2 text-left font-semibold">หมายเหตุ</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {detailData.days.map(day => {
                                                    const cfg = STATUS_CONFIG[day.status] || STATUS_CONFIG.future;
                                                    const dateObj = new Date(day.date);
                                                    const isWeekendOrHoliday = day.status === 'weekend' || day.status === 'holiday';
                                                    const isEditing = editingDate === day.date;
                                                    return (
                                                        <tr key={day.date} className={`${isWeekendOrHoliday ? 'opacity-60' : ''} ${day.status === 'absent' ? 'bg-red-50/50 dark:bg-red-900/10' : ''} ${day.status === 'late' ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                                                            <td className="p-2 whitespace-nowrap">
                                                                <span className="font-semibold text-gray-900 dark:text-white">{dateObj.getDate()}</span>
                                                                <span className={`ml-1 text-xs ${day.day_of_week >= 6 ? 'text-red-400' : 'text-gray-400'}`}>
                                                                    {DOW_TH[day.day_of_week]}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                                                                    <span className="material-icons-round text-xs">{cfg.icon}</span>
                                                                    {cfg.label}
                                                                </span>
                                                            </td>
                                                            <td className={`p-2 text-center text-xs font-mono ${day.status === 'late' ? 'text-orange-600 font-bold' : 'text-gray-600 dark:text-gray-300'}`}>
                                                                {isEditing ? (
                                                                    <input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="w-[75px] px-1 py-0.5 bg-gray-100 dark:bg-gray-800 border-none rounded outline-none focus:ring-1 focus:ring-primary text-center text-primary font-semibold" />
                                                                ) : (
                                                                    fmtTime(day.clock_in)
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-center text-xs font-mono text-gray-600 dark:text-gray-300">
                                                                {isEditing ? (
                                                                    <input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="w-[75px] px-1 py-0.5 bg-gray-100 dark:bg-gray-800 border-none rounded outline-none focus:ring-1 focus:ring-primary text-center text-primary font-semibold" />
                                                                ) : (
                                                                    fmtTime(day.clock_out)
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-center text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                                                {formatTimeDuration(day.work_hours)}
                                                            </td>
                                                            <td className="p-2 text-center text-[11px] whitespace-nowrap">
                                                                {day.ot && day.ot.length > 0 ? (
                                                                    <div className="flex flex-col gap-0.5 items-center">
                                                                        {day.ot.map(o => (
                                                                            <span key={o.id} className="font-mono text-cyan-700 dark:text-cyan-300">
                                                                                {o.start_time}–{o.end_time}
                                                                                <span className="ml-1 font-sans font-bold">×{Number(o.ot_rate).toFixed(1)}</span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300">–</span>
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-xs text-gray-500">
                                                                {isEditing ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <input
                                                                            type="text"
                                                                            value={editAdminNote}
                                                                            onChange={e => setEditAdminNote(e.target.value.slice(0, 200))}
                                                                            placeholder="หมายเหตุ HR..."
                                                                            className="flex-1 min-w-0 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border-none rounded text-[11px] outline-none focus:ring-1 focus:ring-primary text-gray-700 dark:text-gray-200"
                                                                        />
                                                                        <button onClick={() => handleSaveEdit(day.date)} disabled={isSavingEdit} className="flex items-center justify-center w-6 h-6 rounded-full bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 disabled:opacity-50 transition-colors shrink-0">
                                                                            <span className="material-icons-round text-[14px]">check</span>
                                                                        </button>
                                                                        <button onClick={() => setEditingDate(null)} className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 transition-colors shrink-0">
                                                                            <span className="material-icons-round text-[14px]">close</span>
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-start justify-between gap-1">
                                                                        <div className="flex-1 min-w-0">
                                                                            {day.status === 'late' && <span className="text-orange-600 mr-2">สาย {formatMinutesDuration(day.late_minutes)}</span>}
                                                                            {day.status === 'leave' && <span className="text-purple-600 mr-2">{day.leave_type}</span>}
                                                                            {day.status === 'holiday' && <span className="text-blue-600 mr-2">{day.holiday_name}</span>}
                                                                            {day.status === 'absent' && <span className="text-red-600 mr-2">ไม่มาทำงาน</span>}
                                                                            {day.admin_note && (
                                                                                <span className="block mt-0.5 text-gray-700 dark:text-gray-200 italic">
                                                                                    <span className="material-icons-round text-[12px] align-middle text-gray-400 mr-0.5">edit_note</span>
                                                                                    {day.admin_note}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <button onClick={() => {
                                                                            setEditingDate(day.date);
                                                                            setEditClockIn(day.clock_in ? day.clock_in.substring(0, 5) : '');
                                                                            setEditClockOut(day.clock_out ? day.clock_out.substring(0, 5) : '');
                                                                            setEditAdminNote(day.admin_note || '');
                                                                        }} className="text-gray-300 hover:text-primary transition-colors p-1 shrink-0" title="แก้ไขเวลา / หมายเหตุ">
                                                                            <span className="material-icons-round text-[14px]">edit</span>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 text-gray-500">ไม่พบข้อมูล</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ HR RECORD-LEAVE MODAL — admin keys leave on behalf of employee ═══ */}
            {recordLeaveFor && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={closeRecordLeave}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">📝 คีย์การลาให้พนักงาน</h2>
                                <p className="text-xs text-purple-600 dark:text-purple-400 truncate font-semibold mt-0.5">{recordLeaveFor.name}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">บันทึกแบบอนุมัติทันที — ตัด quota อัตโนมัติ</p>
                            </div>
                            <button onClick={closeRecordLeave} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {/* Leave type */}
                            <div>
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">ประเภทการลา *</label>
                                <select
                                    value={recLeaveTypeId}
                                    onChange={e => setRecLeaveTypeId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                >
                                    <option value="">— เลือกประเภท —</option>
                                    {leaveTypeChoices.map(c => (
                                        <option key={c.id} value={String(c.id)}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Date range */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">วันเริ่ม *</label>
                                    <input type="date" value={recLeaveStartDate} max={recLeaveEndDate || undefined}
                                        onChange={e => setRecLeaveStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">วันสิ้นสุด *</label>
                                    <input type="date" value={recLeaveEndDate} min={recLeaveStartDate || undefined}
                                        onChange={e => setRecLeaveEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                                </div>
                            </div>
                            {/* Total days */}
                            <div>
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                                    จำนวนวัน * <span className="text-[10px] font-normal text-gray-400">(ปรับได้ ขั้น 0.5)</span>
                                </label>
                                <input type="number" step="0.5" min="0.5" value={recLeaveDays}
                                    onChange={e => setRecLeaveDays(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none" />
                            </div>
                            {/* Reason */}
                            <div>
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">เหตุผล *</label>
                                <textarea value={recLeaveReason}
                                    onChange={e => setRecLeaveReason(e.target.value)}
                                    rows={2}
                                    placeholder="เหตุผลการลา..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none resize-none" />
                                <p className="text-[10px] text-gray-400 mt-1">ระบบจะใส่ "[HR บันทึกแทน]" นำหน้าให้อัตโนมัติ เพื่อ audit</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex gap-2">
                            <button onClick={closeRecordLeave} disabled={recLeaveSubmitting}
                                className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
                                ยกเลิก
                            </button>
                            <button onClick={handleSubmitRecordLeave} disabled={recLeaveSubmitting}
                                className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                                {recLeaveSubmitting ? (
                                    <>
                                        <span className="material-icons-round text-base animate-spin">autorenew</span>
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-base">save</span>
                                        บันทึก (อนุมัติทันที)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ═══ Progress overlay during PDF export ═══ */}
            {pdfProgress && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl px-8 py-6 max-w-sm w-full mx-4 text-center">
                        <span className="material-icons-round text-purple-600 text-5xl animate-pulse">folder_zip</span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mt-3">กำลัง Export PDF...</h3>
                        <p className="text-sm text-gray-500 mt-1">{pdfProgress.current} / {pdfProgress.total} ไฟล์</p>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mt-4 overflow-hidden">
                            <div className="bg-purple-500 h-full rounded-full transition-all duration-200"
                                style={{ width: `${(pdfProgress.current / Math.max(1, pdfProgress.total)) * 100}%` }} />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-3">โปรดอย่าปิดหน้าเว็บระหว่างที่กำลังประมวลผล</p>
                    </div>
                </div>
            )}

            {/* Print stylesheet — used when "พิมพ์ / บันทึก PDF" is invoked */}
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    body { background: white !important; }
                    /* Hide non-essential UI */
                    header button, .print-hide,
                    nav, aside, [role="dialog"] { display: none !important; }
                    /* Show full table without horizontal scroll */
                    .overflow-x-auto { overflow: visible !important; }
                    table { min-width: 0 !important; width: 100% !important; font-size: 10px !important; page-break-inside: auto; }
                    thead { display: table-header-group; }
                    tr { page-break-inside: avoid; }
                    /* Hide the mobile cards in print */
                    .md\\:hidden { display: none !important; }
                    /* Force light theme for print */
                    .dark\\:bg-gray-800, .dark\\:bg-gray-900, .dark\\:bg-gray-900\\/50 { background: white !important; }
                    .dark\\:text-white, .dark\\:text-gray-300, .dark\\:text-gray-400 { color: #111 !important; }
                    /* Avoid page break inside summary cards */
                    .grid > div { page-break-inside: avoid; }
                }
            `}</style>
        </div>
    );
};

export default AdminAttendanceReportScreen;
