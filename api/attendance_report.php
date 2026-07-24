<?php
/**
 * HR Attendance Summary Report API
 * 
 * GET /api/attendance_report.php?month=2026-02                     → all employees summary
 * GET /api/attendance_report.php?month=2026-02&employee_id=EMP001  → single employee
 * GET /api/attendance_report.php?year=2026                         → annual summary
 * GET /api/attendance_report.php?month=2026-02&export=csv          → CSV download
 * GET /api/attendance_report.php?year=2026&export=csv              → annual CSV
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/schedule_helper.php';

$method = get_method();
$company_id = get_company_id();
if ($method !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

// ─── Parameters ───
$month = $_GET['month'] ?? null;              // e.g. "2026-02"
$year = $_GET['year'] ?? null;                // e.g. "2026"
$date = $_GET['date'] ?? null;                // e.g. "2026-04-10"
$cutoff_month = $_GET['cutoff_month'] ?? null; // e.g. "2026-04" → 21 Mar - 20 Apr
$date_from = $_GET['date_from'] ?? null;      // e.g. "2026-04-01" (custom range start)
$date_to = $_GET['date_to'] ?? null;          // e.g. "2026-04-27" (custom range end)
$employee_id = $_GET['employee_id'] ?? null;
// Multi-select support: comma-separated list of employee IDs
$employee_ids_raw = $_GET['employee_ids'] ?? null;
$employee_ids = null;
if ($employee_ids_raw !== null && $employee_ids_raw !== '') {
    $employee_ids = array_values(array_filter(array_map('trim', explode(',', $employee_ids_raw)), function ($v) {
        return $v !== '';
    }));
    if (empty($employee_ids)) $employee_ids = null;
}
$department_id = isset($_GET['department_id']) && $_GET['department_id'] !== '' ? (int)$_GET['department_id'] : null;
$export = $_GET['export'] ?? null;            // "csv"

if (!$month && !$year && !$date && !$cutoff_month && !($date_from && $date_to)) {
    json_response(['error' => 'month, year, date, cutoff_month, or date_from+date_to parameter is required'], 400);
}

/**
 * Effective work hours for a day: clamps clock_in/out to the scheduled work
 * window (so early arrival or staying past close doesn't inflate totals),
 * then subtracts any lunch-break overlap (default 12:00–13:00).
 *
 * Example: Telesale 09:00–18:00, employee clocks 08:29 → 18:03
 *   raw = 9.57h, but effective = max(09:00) → min(18:00) = 9.00h - 1h lunch = 8.00h
 */
function calc_effective_work_hours($clockIn, $clockOut, $workStart, $workEnd, $lunchStart = '12:00:00', $lunchEnd = '13:00:00'): float {
    $toSec = static function ($t) {
        $parts = array_pad(explode(':', $t), 3, 0);
        return ((int) $parts[0]) * 3600 + ((int) $parts[1]) * 60 + ((int) $parts[2]);
    };
    $cin = $toSec($clockIn);
    $cout = $toSec($clockOut);
    $sin = $toSec($workStart);
    $sout = $toSec($workEnd);
    $effIn = max($cin, $sin);
    $effOut = min($cout, $sout);
    if ($effOut <= $effIn) return 0.0;
    $worked = $effOut - $effIn;
    // Lunch overlap
    $lin = $toSec($lunchStart);
    $lout = $toSec($lunchEnd);
    $overlap = max(0, min($effOut, $lout) - max($effIn, $lin));
    $worked -= $overlap;
    return max(0.0, $worked / 3600);
}

// ─── Daily detail for a single employee ───
$action = $_GET['action'] ?? null;
if ($action === 'daily' && $employee_id && ($month || $cutoff_month || ($date_from && $date_to))) {
    if ($date_from && $date_to) {
        $startDate = $date_from;
        $endDate = $date_to;
    } elseif ($cutoff_month) {
        $endDate = $cutoff_month . '-20';
        $prevDt = new DateTime($cutoff_month . '-01');
        $prevDt->modify('-1 month');
        $startDate = $prevDt->format('Y-m') . '-21';
    } else {
        $startDate = $month . '-01';
        $endDate = date('Y-m-t', strtotime($startDate));
    }

    // Get employee info + dept fallback fields for schedule resolver
    $empStmt = $conn->prepare("SELECT e.id, e.name, e.department_id, e.hire_date, e.schedule_json, e.late_grace_minutes,
                                      d.name AS department,
                                      d.work_start_time, d.work_end_time,
                                      d.schedule_json AS dept_schedule_json,
                                      d.late_grace_minutes AS dept_late_grace_minutes,
                                      d.work_start_time AS dept_work_start_time,
                                      d.work_end_time AS dept_work_end_time
                                FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $emp = $empStmt->get_result()->fetch_assoc();
    if (!$emp) json_response(['error' => 'Employee not found'], 404);

    // Default fallback: still expose work_start_time/work_end_time for the modal header
    $workStart = $emp['work_start_time'] ?? '09:00:00';
    $workEnd = $emp['work_end_time'] ?? '17:00:00';
    $empHireDate = $emp['hire_date'] ?? null;

    // Get attendance records indexed by date
    $attMap = [];
    $attStmt = $conn->prepare("SELECT date, clock_in, clock_out, admin_note, edited_by, edited_at FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?");
    $attStmt->bind_param('sss', $employee_id, $startDate, $endDate);
    $attStmt->execute();
    $attRes = $attStmt->get_result();
    while ($a = $attRes->fetch_assoc()) {
        $attMap[$a['date']] = $a;
    }

    // Get OT entries — leave_requests with [OT] reason, for this employee in range.
    // Grouped by DATE(start_date) since OT is typically same-day.
    $otByDate = [];
    $otStmt = $conn->prepare(
        "SELECT id, start_date, end_date, total_days AS hours, ot_rate, reason, status
         FROM leave_requests
         WHERE employee_id = ?
           AND reason LIKE '[OT]%'
           AND DATE(start_date) BETWEEN ? AND ?"
    );
    $otStmt->bind_param('sss', $employee_id, $startDate, $endDate);
    $otStmt->execute();
    $otRes = $otStmt->get_result();
    while ($ot = $otRes->fetch_assoc()) {
        $sDt = new DateTime($ot['start_date']);
        $eDt = new DateTime($ot['end_date']);
        $dateKey = $sDt->format('Y-m-d');
        // Strip "[OT] " prefix from reason for cleaner display
        $cleanReason = preg_replace('/^\[OT\]\s*/', '', $ot['reason']);
        $otByDate[$dateKey][] = [
            'id' => (int)$ot['id'],
            'date' => $dateKey,
            'start_time' => $sDt->format('H:i'),
            'end_time' => $eDt->format('H:i'),
            'hours' => (float)$ot['hours'],
            'ot_rate' => $ot['ot_rate'] !== null ? (float)$ot['ot_rate'] : 1.0,
            'reason' => $cleanReason,
            'status' => $ot['status'],
        ];
    }

    // Get holidays indexed by date (prepared statement)
    $holidayMap = [];
    $hStmt2 = $conn->prepare("SELECT date, name FROM holidays WHERE company_id = ? AND date BETWEEN ? AND ?");
    $hStmt2->bind_param('iss', $company_id, $startDate, $endDate);
    $hStmt2->execute();
    $hRes2 = $hStmt2->get_result();
    while ($h = $hRes2->fetch_assoc()) {
        $holidayMap[$h['date']] = $h['name'];
    }

    // Working-day overrides for this range: manual ∪ inferred-from-dept-turnout
    $workIdx = merge_workday_index(
        fetch_workday_index($conn, $company_id, $startDate, $endDate),
        fetch_inferred_workday_index($conn, $company_id, $startDate, $endDate)
    );

    // Get approved leaves with dates
    $leaveMap = []; // date => leave info
    $lvStmt = $conn->prepare(
        "SELECT lr.start_date, lr.end_date, lr.total_days, lt.name AS leave_type_name
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = ? AND lr.status = 'approved'
           AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ?"
    );
    $lvStmt->bind_param('sss', $employee_id, $endDate, $startDate);
    $lvStmt->execute();
    $lvRes = $lvStmt->get_result();
    while ($lv = $lvRes->fetch_assoc()) {
        // Clamp against full-day bounds (not bare date strings) — otherwise PHP's
        // string-based max()/min() treats "2026-06-30" as earlier than
        // "2026-06-30 23:59:00" and the leave's last day never gets iterated.
        $cur = new DateTime(max($lv['start_date'], $startDate . ' 00:00:00'));
        $lvEnd = new DateTime(min($lv['end_date'], $endDate . ' 23:59:59'));
        while ($cur <= $lvEnd) {
            $d = $cur->format('Y-m-d');
            $leaveMap[$d] = $lv['leave_type_name'];
            $cur->modify('+1 day');
        }
    }

    // Build daily rows
    $days = [];
    $current = new DateTime($startDate);
    $endDt = new DateTime($endDate);
    $today = date('Y-m-d');

    while ($current <= $endDt) {
        $dateStr = $current->format('Y-m-d');
        $dow = (int)$current->format('N');
        $att = $attMap[$dateStr] ?? null;
        $sched = resolve_schedule_for_date($emp, $dateStr, $workIdx);

        $status = '';
        $clockIn = $att['clock_in'] ?? null;
        $clockOut = $att['clock_out'] ?? null;
        $lateMinutes = 0;
        $leaveType = $leaveMap[$dateStr] ?? null;
        $holidayName = $holidayMap[$dateStr] ?? null;

        // Records-driven precedence: an approved leave or an actual clock-in is
        // shown even on an off-schedule day, so irregular Saturday shifts/leave
        // surface instead of being hidden under "วันหยุด". A day with NO record
        // that is off-schedule stays "weekend" (never falsely "absent").
        if ($holidayName) {
            $status = 'holiday';
        } elseif ($leaveType) {
            $isWfh = (stripos($leaveType, 'wfh') !== false || stripos($leaveType, 'work from home') !== false);
            $status = $isWfh ? 'wfh' : 'leave';
        } elseif ($att && $clockIn) {
            if (!$sched['active']) {
                // Clocked in on an off-schedule day → flag for HR as OT candidate
                $status = 'offday_work';
            } else {
                [$lateFlag, $lateMin] = is_late($clockIn, $sched);
                $lateMinutes = $lateMin;
                $status = $lateFlag ? 'late' : 'present';
            }
        } elseif (!$sched['active']) {
            $status = 'weekend';
        } elseif ($empHireDate && $dateStr < $empHireDate) {
            $status = 'pre_hire';
        } elseif ($dateStr <= $today) {
            $status = 'absent';
        } else {
            $status = 'future';
        }

        // Work hours for the day — effective on scheduled days, raw on off-schedule worked days
        $workHours = 0;
        if ($clockIn && $clockOut) {
            $workHours = round(day_work_hours($clockIn, $clockOut, $sched), 2);
        }

        $otForDay = $otByDate[$dateStr] ?? [];

        $days[] = [
            'date' => $dateStr,
            'day_of_week' => $dow,
            'status' => $status,
            'clock_in' => $clockIn,
            'clock_out' => $clockOut,
            'late_minutes' => $lateMinutes,
            'work_hours' => $workHours,
            'leave_type' => $leaveType,
            'holiday_name' => $holidayName,
            'admin_note' => $att['admin_note'] ?? null,
            'edited_by' => $att['edited_by'] ?? null,
            'edited_at' => $att['edited_at'] ?? null,
            'ot' => $otForDay, // array of OT entries on this day (usually 0 or 1)
        ];
        $current->modify('+1 day');
    }

    // Flat list of all OT entries in the period (for the modal summary card)
    $otList = [];
    foreach ($otByDate as $arr) foreach ($arr as $e) $otList[] = $e;

    json_response([
        'employee_id' => $emp['id'],
        'employee_name' => $emp['name'],
        'department' => $emp['department'] ?? '-',
        'work_start_time' => $workStart,
        'work_end_time' => $workEnd,
        'month' => $month,
        'days' => $days,
        'ot_entries' => $otList,
    ]);
}

// ─── CSV Specific Day Export ───
if ($export === 'csv_specific_day' && $date) {
    $specificDate = $date;
    $bom = "\xEF\xBB\xBF";
    $filename = $employee_id 
        ? "attendance_specific_{$employee_id}_{$specificDate}.csv"
        : "attendance_specific_{$specificDate}.csv";
    
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$filename\"");
    
    $out = fopen('php://output', 'w');
    fwrite($out, $bom);

    $dowNames = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
    $statusLabels = [
        'present' => 'มาทำงาน',
        'late'    => 'สาย',
        'absent'  => 'ขาดงาน',
        'leave'   => 'ลา',
        'holiday' => 'หยุดนักขัตฤกษ์',
        'weekend' => 'วันหยุด',
        'offday_work' => 'ทำงานวันหยุด',
        'future'  => '-'
    ];

    $dt = new DateTime($specificDate);
    $dow = (int)$dt->format('N');
    $thMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 
                 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    $dateFormatted = $dt->format('d') . ' ' . $thMonths[(int)$dt->format('m')] . ' ' . ((int)$dt->format('Y') + 543);

    fputcsv($out, ["รายงานเข้างานประจำวันที่ $dateFormatted"]);
    fputcsv($out, []); // blank line
    fputcsv($out, ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'เวลาเข้างานตามกะ', 'สถานะ', 'เวลาเข้า', 'เวลาออก', 'สาย (นาที)', 'ชม.ทำงาน', 'หมายเหตุ']);

    // Get holiday (prepared statement)
    $hdName = null;
    $hdStmt = $conn->prepare("SELECT name FROM holidays WHERE company_id = ? AND date = ?");
    $hdStmt->bind_param('is', $company_id, $specificDate);
    $hdStmt->execute();
    $hdRes = $hdStmt->get_result();
    if ($h = $hdRes->fetch_assoc()) {
        $hdName = $h['name'];
    }

    // Working-day overrides for this single date: manual ∪ inferred-from-dept-turnout
    $workIdxSpec = merge_workday_index(
        fetch_workday_index($conn, $company_id, $specificDate, $specificDate),
        fetch_inferred_workday_index($conn, $company_id, $specificDate, $specificDate)
    );

    // Employees (with department filter)
    $edWhere = "e.is_active = 1 AND e.company_id = ?";
    $edParams = [$company_id];
    $edTypes = 'i';
    if ($employee_id) {
        $edWhere .= " AND e.id = ?";
        $edParams[] = $employee_id;
        $edTypes .= 's';
    }
    if ($department_id) {
        $edWhere .= " AND e.department_id = ?";
        $edParams[] = $department_id;
        $edTypes .= 'i';
    }
    $edStmt = $conn->prepare("SELECT e.id, e.name, e.department_id, e.schedule_json, e.late_grace_minutes,
                                      d.name AS department, d.work_start_time, d.work_end_time,
                                      d.schedule_json AS dept_schedule_json,
                                      d.late_grace_minutes AS dept_late_grace_minutes,
                                      d.work_start_time AS dept_work_start_time,
                                      d.work_end_time AS dept_work_end_time
                               FROM employees e LEFT JOIN departments d ON e.department_id = d.id
                               WHERE $edWhere ORDER BY d.name, e.name");
    $edStmt->bind_param($edTypes, ...$edParams);
    $edStmt->execute();
    $edResult = $edStmt->get_result();

    $todayD = date('Y-m-d');

    // Fetch leaves for the day
    $lMap = [];
    $lStmt = $conn->prepare(
        "SELECT lr.employee_id, lt.name AS leave_type_name
         FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.status = 'approved'
           AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ?"
    );
    $lStmt->bind_param('ss', $specificDate, $specificDate);
    $lStmt->execute();
    $lRes = $lStmt->get_result();
    while ($lv = $lRes->fetch_assoc()) {
        $lMap[$lv['employee_id']] = $lv['leave_type_name'];
    }

    // Fetch attendances for the day
    $aMap = [];
    $aStmt = $conn->prepare("SELECT employee_id, clock_in, clock_out FROM attendance WHERE date = ?");
    $aStmt->bind_param('s', $specificDate);
    $aStmt->execute();
    $aRes = $aStmt->get_result();
    while ($a = $aRes->fetch_assoc()) {
        $aMap[$a['employee_id']] = $a;
    }

    while ($emp = $edResult->fetch_assoc()) {
        $eid = $emp['id'];
        // Schedule-aware: respects per-employee/department schedule_json (6-day,
        // alternating-week) instead of the old hardcoded "$dow > 5" weekend.
        $sched = resolve_schedule_for_date($emp, $specificDate, $workIdxSpec);
        $workStart = $sched['active'] ? ($sched['in'] . ':00') : ($emp['work_start_time'] ?? '09:00:00');

        $att = $aMap[$eid] ?? null;
        $clockIn = $att['clock_in'] ?? null;
        $clockOut = $att['clock_out'] ?? null;
        $leaveType = $lMap[$eid] ?? null;

        $lateMin = 0;
        $wHours = 0;
        $note = '';

        // Records-driven precedence: leave/attendance surface even on off-schedule days
        if ($hdName) {
            $status = 'holiday';
            $note = $hdName;
        } elseif ($leaveType) {
            $isWfh = (stripos($leaveType, 'wfh') !== false || stripos($leaveType, 'work from home') !== false);
            $status = $isWfh ? 'wfh' : 'leave';
            $note = $leaveType;
        } elseif ($att && $clockIn) {
            if (!$sched['active']) {
                $status = 'offday_work';
            } else {
                [$lateFlag, $lateMin] = is_late($clockIn, $sched);
                $status = $lateFlag ? 'late' : 'present';
            }
        } elseif (!$sched['active']) {
            $status = 'weekend';
        } elseif ($specificDate <= $todayD) {
            $status = 'absent';
        } else {
            $status = 'future';
        }

        if ($clockIn && $clockOut) {
            // Effective hours on scheduled days, raw on off-schedule worked days
            $wHours = round(day_work_hours($clockIn, $clockOut, $sched), 2);
        }

        fputcsv($out, [
            $eid,
            $emp['name'],
            $emp['department'] ?? '-',
            substr($workStart, 0, 5) . ' น.',
            $statusLabels[$status] ?? $status,
            $clockIn ? substr($clockIn, 0, 5) : '-',
            $clockOut ? substr($clockOut, 0, 5) : '-',
            $lateMin > 0 ? $lateMin : '',
            $wHours > 0 ? $wHours : '',
            $note,
        ]);
    }

    fclose($out);
    exit;
}

// ─── Determine date range ───
$today = date('Y-m-d');
if ($date_from && $date_to) {
    // Custom date range: date_from=2026-04-01&date_to=2026-04-27
    $startDate = $date_from;
    $endDate = $date_to;
    $periodLabel = $date_from . '_to_' . $date_to;
} elseif ($cutoff_month) {
    // cutoff_month=2026-04 → 21 Mar - 20 Apr (ตัดรอบวันที่ 20)
    $endDate = $cutoff_month . '-20';
    $prevDt = new DateTime($cutoff_month . '-01');
    $prevDt->modify('-1 month');
    $startDate = $prevDt->format('Y-m') . '-21';
    $periodLabel = 'cutoff_' . $cutoff_month;
} elseif ($month) {
    $startDate = $month . '-01';
    $endDate = date('Y-m-t', strtotime($startDate));
    $periodLabel = $month;
} else {
    $startDate = $year . '-01-01';
    $endDate = $year . '-12-31';
    $periodLabel = $year;
}
// Cap end date at today for expected-work-days (don't count future days as absent)
$effectiveEndDate = ($endDate > $today) ? $today : $endDate;

// ─── Helper: generic Mon–Fri working-day count (header baseline only) ───
// NOTE: This is a company-wide Mon–Fri baseline used solely for the report's
// top-level "วันทำงาน" header figure. Per-employee expected days are computed
// schedule-aware below (see $empExpectedWorkDays via resolve_schedule_for_date),
// and those per-row numbers are authoritative for absence/diligence math.
function getWorkingDays($start, $end, $holidayDates = []) {
    $count = 0;
    $current = new DateTime($start);
    $endDt = new DateTime($end);
    while ($current <= $endDt) {
        $dow = (int)$current->format('N');
        $dateStr = $current->format('Y-m-d');
        if ($dow <= 5 && !in_array($dateStr, $holidayDates)) {
            $count++;
        }
        $current->modify('+1 day');
    }
    return $count;
}

// ─── Fetch holidays (prepared statement) ───
$holidayDates = [];
$holidayMap = [];
$hStmt = $conn->prepare("SELECT date, name FROM holidays WHERE company_id = ? AND date BETWEEN ? AND ?");
$hStmt->bind_param('iss', $company_id, $startDate, $endDate);
$hStmt->execute();
$hRes = $hStmt->get_result();
while ($h = $hRes->fetch_assoc()) {
    $holidayDates[] = $h['date'];
    $holidayMap[$h['date']] = $h['name'];
}

// ─── Working-day overrides for the whole period (used by the report loop AND
//     the csv_daily export below): manual วันทำงานพิเศษ ∪ inferred-from-turnout
//     (a date where >50% of a department clocked in counts as that dept's workday). ───
$workIdx = merge_workday_index(
    fetch_workday_index($conn, $company_id, $startDate, $endDate),
    fetch_inferred_workday_index($conn, $company_id, $startDate, $endDate)
);

// ─── Fetch departments (for filter dropdown) ───
$departments = [];
$dStmt = $conn->prepare("SELECT id, name FROM departments WHERE company_id = ? ORDER BY name");
$dStmt->bind_param('i', $company_id);
$dStmt->execute();
$dRes = $dStmt->get_result();
while ($d = $dRes->fetch_assoc()) {
    $departments[] = $d;
}

// ─── Fetch all leave types (prepared statement) ───
$leaveTypes = [];
$ltStmt = $conn->prepare("SELECT id, name, type FROM leave_types WHERE is_active = 1 AND company_id = ? ORDER BY id");
$ltStmt->bind_param('i', $company_id);
$ltStmt->execute();
$ltRes = $ltStmt->get_result();
while ($lt = $ltRes->fetch_assoc()) {
    $leaveTypes[] = $lt;
}

// ─── Fetch employees (with department filter) ───
$empWhere = "e.is_active = 1 AND e.company_id = ?";
$empParams = [$company_id];
$empTypes = 'i';
if ($employee_ids !== null && count($employee_ids) > 0) {
    // Multi-select: IN clause
    $placeholders = implode(',', array_fill(0, count($employee_ids), '?'));
    $empWhere .= " AND e.id IN ($placeholders)";
    foreach ($employee_ids as $eid) {
        $empParams[] = $eid;
        $empTypes .= 's';
    }
} elseif ($employee_id) {
    $empWhere .= " AND e.id = ?";
    $empParams[] = $employee_id;
    $empTypes .= 's';
}
if ($department_id) {
    $empWhere .= " AND e.department_id = ?";
    $empParams[] = $department_id;
    $empTypes .= 'i';
}

$empSql = "SELECT e.id, e.name, e.department_id, e.hire_date, e.base_salary,
                  e.schedule_json, e.late_grace_minutes,
                  d.name AS department, d.work_start_time, d.work_end_time,
                  d.schedule_json AS dept_schedule_json,
                  d.late_grace_minutes AS dept_late_grace_minutes,
                  d.work_start_time AS dept_work_start_time,
                  d.work_end_time AS dept_work_end_time
           FROM employees e
           LEFT JOIN departments d ON e.department_id = d.id
           WHERE $empWhere
           ORDER BY d.name, e.name";

$empStmt = $conn->prepare($empSql);
$empStmt->bind_param($empTypes, ...$empParams);
$empStmt->execute();
$empResult = $empStmt->get_result();

// Expected work days up to today (for absence calculation)
$expectedWorkDays = getWorkingDays($startDate, $effectiveEndDate, $holidayDates);
// Full period expected work days (for display)
$fullPeriodWorkDays = getWorkingDays($startDate, $endDate, $holidayDates);

$report = [];

// ── Collect employee list ──
$employees = [];
while ($emp = $empResult->fetch_assoc()) {
    $employees[] = $emp;
}

if (!empty($employees)) {
    $empIds = array_column($employees, 'id');
    $idPlaceholders = implode(',', array_fill(0, count($empIds), '?'));
    $idTypes = str_repeat('s', count($empIds));

    // ── BATCH: Attendance data (1 query for ALL employees) ──
    $attAll = [];
    $attSql = "SELECT employee_id, date, clock_in, clock_out FROM attendance 
               WHERE employee_id IN ($idPlaceholders) AND date BETWEEN ? AND ?";
    $attStmt = $conn->prepare($attSql);
    $attParams = array_merge($empIds, [$startDate, $endDate]);
    $attStmt->bind_param($idTypes . 'ss', ...$attParams);
    $attStmt->execute();
    $attRes = $attStmt->get_result();
    while ($a = $attRes->fetch_assoc()) {
        $attAll[$a['employee_id']][] = $a;
    }

    // ── BATCH: Leave data (1 query for ALL employees, fix overlap) ──
    $leaveAll = [];
    $lvSql = "SELECT lr.employee_id, lr.leave_type_id, lt.name AS leave_type_name, lt.type AS leave_category,
                     lr.start_date, lr.end_date, lr.total_days
              FROM leave_requests lr
              JOIN leave_types lt ON lr.leave_type_id = lt.id
              WHERE lr.employee_id IN ($idPlaceholders)
                AND lr.status = 'approved'
                AND lr.reason NOT LIKE '[OT]%'
                AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ?";
    $lvStmt = $conn->prepare($lvSql);
    $lvParams = array_merge($empIds, [$endDate, $startDate]);
    $lvStmt->bind_param($idTypes . 'ss', ...$lvParams);
    $lvStmt->execute();
    $lvRes = $lvStmt->get_result();
    while ($lv = $lvRes->fetch_assoc()) {
        $leaveAll[$lv['employee_id']][] = $lv;
    }

    // ── BATCH: OT data (1 query for ALL employees) ──
    $otAll = [];
    $otSql = "SELECT lr.employee_id, SUM(lr.total_days) AS ot_hours
              FROM leave_requests lr
              WHERE lr.employee_id IN ($idPlaceholders)
                AND lr.status = 'approved'
                AND lr.reason LIKE '[OT]%'
                AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ?
              GROUP BY lr.employee_id";
    $otStmt = $conn->prepare($otSql);
    $otParams = array_merge($empIds, [$endDate, $startDate]);
    $otStmt->bind_param($idTypes . 'ss', ...$otParams);
    $otStmt->execute();
    $otRes = $otStmt->get_result();
    while ($ot = $otRes->fetch_assoc()) {
        $otAll[$ot['employee_id']] = (float)$ot['ot_hours'];
    }

    // ── Process each employee from in-memory data ──
    foreach ($employees as $emp) {
        $eid = $emp['id'];
        $workStart = $emp['work_start_time'] ?? '09:00:00';
        $workEnd = $emp['work_end_time'] ?? '17:00:00';
        $empHireDate = $emp['hire_date'] ?? null;
        $empAttendance = $attAll[$eid] ?? [];
        $empLeaves = $leaveAll[$eid] ?? [];
        $otHours = $otAll[$eid] ?? 0;

        // Date sets for per-day absence: a scheduled working day with neither a
        // clock-record nor an approved leave is the only thing that counts as absent.
        // (Robust vs the old subtractive formula, where an off-schedule Saturday leave
        //  could silently cancel out a real weekday absence in the arithmetic.)
        $attDateSet = [];
        foreach ($empAttendance as $att) $attDateSet[$att['date']] = true;
        $leaveDateSet = [];
        foreach ($empLeaves as $lv) {
            $lc = new DateTime($lv['start_date']);
            $le = new DateTime($lv['end_date']);
            while ($lc <= $le) { $leaveDateSet[$lc->format('Y-m-d')] = true; $lc->modify('+1 day'); }
        }

        // Per-employee expected work days — counts only days where THIS employee's
        // resolved schedule is "active" (handles weekend variability + alternating-week).
        // Also respects hire_date: pre-hire days never count as expected.
        $empPeriodStart = ($empHireDate && $empHireDate > $startDate) ? $empHireDate : $startDate;
        $empExpectedWorkDays = 0;
        $empFullPeriodWorkDays = 0;
        $empAbsentDays = 0;
        if ($empPeriodStart <= $endDate) {
            $cur = new DateTime($empPeriodStart);
            $endFull = new DateTime($endDate);
            $endEff = new DateTime($effectiveEndDate);
            while ($cur <= $endFull) {
                $dStr = $cur->format('Y-m-d');
                if (!in_array($dStr, $holidayDates)) {
                    $sched = resolve_schedule_for_date($emp, $dStr, $workIdx);
                    if ($sched['active']) {
                        $empFullPeriodWorkDays++;
                        if ($cur <= $endEff) {
                            $empExpectedWorkDays++;
                            // Absent = scheduled working day, already elapsed, no clock + no leave
                            if (!isset($attDateSet[$dStr]) && !isset($leaveDateSet[$dStr])) {
                                $empAbsentDays++;
                            }
                        }
                    }
                }
                $cur->modify('+1 day');
            }
        }

        $actualWorkDays = 0;
        $lateDays = 0;
        $lateMinutesTotal = 0;
        $earlyDays = 0;
        $earlyMinutesTotal = 0;
        $totalWorkHours = 0;

        foreach ($empAttendance as $att) {
            $actualWorkDays++;
            $sched = resolve_schedule_for_date($emp, $att['date'], $workIdx);
            if (!$sched['active']) {
                // Clocked in on a non-working day (e.g. weekend OT) — don't count
                // toward late/early/work hours, but actualWorkDays already incremented.
                continue;
            }
            if ($att['clock_in']) {
                [$lateFlag, $lateMin] = is_late($att['clock_in'], $sched);
                if ($lateFlag) {
                    $lateDays++;
                    $lateMinutesTotal += $lateMin;
                }
            }
            if ($att['clock_out']) {
                [$earlyFlag, $earlyMin] = is_early_leave($att['clock_out'], $sched);
                if ($earlyFlag) {
                    $earlyDays++;
                    $earlyMinutesTotal += $earlyMin;
                }
            }
            if ($att['clock_in'] && $att['clock_out']) {
                $totalWorkHours += calc_effective_work_hours_v2($att['clock_in'], $att['clock_out'], $sched);
            }
        }

        // ── Leave: count actual days within period (fix overlap) ──
        $leaveByTypeMap = [];
        $totalLeaveDays = 0;
        $nonAnnualLeaveDays = 0;

        foreach ($empLeaves as $lv) {
            $ltId = (int)$lv['leave_type_id'];
            // Fix: count only days within the period, not total_days
            // Compare DATE-only portions (both 'Y-m-d') — comparing the raw
            // datetime strings against bare $startDate/$endDate breaks whenever
            // the leave's time-of-day makes it the "longer" (lexicographically
            // greater) string even though it falls on the boundary day.
            if (substr($lv['start_date'], 0, 10) >= $startDate && substr($lv['end_date'], 0, 10) <= $endDate) {
                $days = (float)$lv['total_days']; // entirely within period (total_days is schedule-correct, recomputed server-side at request time)
            } else {
                // Leave spans the period boundary → recount only THIS employee's
                // active working days inside the period (schedule-aware: honours
                // 6-day / alternating-week schedules, not hardcoded Mon–Fri).
                $days = count_active_workdays($emp, max($lv['start_date'], $startDate . ' 00:00:00'), min($lv['end_date'], $endDate . ' 23:59:59'), $holidayDates, $workIdx);
            }
            if (!isset($leaveByTypeMap[$ltId])) {
                $leaveByTypeMap[$ltId] = [
                    'leave_type_id' => $ltId,
                    'leave_type_name' => $lv['leave_type_name'],
                    'leave_category' => $lv['leave_category'],
                    'days' => 0,
                ];
            }
            $leaveByTypeMap[$ltId]['days'] += $days;
            
            $isWfh = (stripos($lv['leave_type_name'], 'wfh') !== false || stripos($lv['leave_type_name'], 'work from home') !== false);
            if (!$isWfh) {
                $totalLeaveDays += $days;
                if ($lv['leave_category'] !== 'annual') {
                    $nonAnnualLeaveDays += $days;
                }
            }
        }

        // Per-day absence (counted in the expected-days loop above) — accurate even
        // when off-schedule Saturday leave/attendance is present.
        $absentDays = $empAbsentDays;
        $diligenceEligible = ($lateDays == 0 && $nonAnnualLeaveDays == 0 && $absentDays == 0);

        $report[] = [
            'employee_id' => $eid,
            'employee_name' => $emp['name'],
            'department' => $emp['department'] ?? '-',
            'base_salary' => (float)($emp['base_salary'] ?? 0),
            'work_start_time' => $workStart,
            'work_end_time' => $workEnd,
            'expected_work_days' => $empExpectedWorkDays,
            'full_period_work_days' => $empFullPeriodWorkDays,
            'actual_work_days' => $actualWorkDays,
            'absent_days' => $absentDays,
            'late_count' => $lateDays,
            'late_minutes_total' => round($lateMinutesTotal),
            'early_leave_count' => $earlyDays,
            'early_leave_minutes_total' => round($earlyMinutesTotal),
            'leave_by_type' => array_values($leaveByTypeMap),
            'total_leave_days' => $totalLeaveDays,
            'ot_hours' => $otHours,
            'total_work_hours' => round($totalWorkHours, 2),
            'diligence_eligible' => $diligenceEligible,
        ];
    }
}

// ─── CSV Daily Detail Export ───
if ($export === 'csv_daily' && ($month || $cutoff_month)) {
    $bom = "\xEF\xBB\xBF";
    $filename = $employee_id 
        ? "attendance_daily_{$employee_id}_{$periodLabel}.csv"
        : "attendance_daily_{$periodLabel}.csv";
    
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$filename\"");
    
    $out = fopen('php://output', 'w');
    fwrite($out, $bom);

    $startDateD = $startDate; // already computed with cutoff support
    $endDateD = $endDate;
    $todayD = date('Y-m-d');
    $dowNames = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

    $statusLabels = [
        'present' => 'มาทำงาน',
        'late'    => 'สาย',
        'absent'  => 'ขาดงาน',
        'leave'   => 'ลา',
        'holiday' => 'หยุดนักขัตฤกษ์',
        'weekend' => 'วันหยุด',
        'offday_work' => 'ทำงานวันหยุด',
        'future'  => '-',
    ];

    // Use pre-fetched holidays
    $hdMap = $holidayMap;

    // Build employee list with department filter (prepared statements)
    $edWhere = "e.is_active = 1 AND e.company_id = ?";
    $edParams = [$company_id];
    $edTypes = 'i';
    if ($employee_id) {
        $edWhere .= " AND e.id = ?";
        $edParams[] = $employee_id;
        $edTypes .= 's';
    }
    if ($department_id) {
        $edWhere .= " AND e.department_id = ?";
        $edParams[] = $department_id;
        $edTypes .= 'i';
    }
    $edStmt = $conn->prepare("SELECT e.id, e.name, e.department_id, e.schedule_json, e.late_grace_minutes,
                                      d.name AS department, d.work_start_time, d.work_end_time,
                                      d.schedule_json AS dept_schedule_json,
                                      d.late_grace_minutes AS dept_late_grace_minutes,
                                      d.work_start_time AS dept_work_start_time,
                                      d.work_end_time AS dept_work_end_time
                               FROM employees e LEFT JOIN departments d ON e.department_id = d.id
                               WHERE $edWhere ORDER BY d.name, e.name");
    $edStmt->bind_param($edTypes, ...$edParams);
    $edStmt->execute();
    $edResult = $edStmt->get_result();

    $thMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 
                 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    $mNum = (int)date('m', strtotime($startDateD));
    $yTh = (int)date('Y', strtotime($startDateD)) + 543;
    $periodTh = $thMonths[$mNum] . ' ' . $yTh;

    // Title row
    fputcsv($out, ["รายงานเข้างานรายวัน - $periodTh"]);
    fputcsv($out, []); // blank line

    $empCount = 0;
    while ($edEmp = $edResult->fetch_assoc()) {
        $eid = $edEmp['id'];
        $workStart = $edEmp['work_start_time'] ?? '09:00:00';
        $workEnd = $edEmp['work_end_time'] ?? '17:00:00';

        // Attendance records
        $aMap = [];
        $aStmt = $conn->prepare("SELECT date, clock_in, clock_out FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?");
        $aStmt->bind_param('sss', $eid, $startDateD, $endDateD);
        $aStmt->execute();
        $aRes = $aStmt->get_result();
        while ($a = $aRes->fetch_assoc()) $aMap[$a['date']] = $a;

        // Leave records
        $lMap = [];
        $lStmt = $conn->prepare(
            "SELECT lr.start_date, lr.end_date, lt.name AS leave_type_name
             FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.employee_id = ? AND lr.status = 'approved'
               AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ?"
        );
        $lStmt->bind_param('sss', $eid, $endDateD, $startDateD);
        $lStmt->execute();
        $lRes = $lStmt->get_result();
        while ($lv = $lRes->fetch_assoc()) {
            $cur = new DateTime(max($lv['start_date'], $startDateD . ' 00:00:00'));
            $lvEnd = new DateTime(min($lv['end_date'], $endDateD . ' 23:59:59'));
            while ($cur <= $lvEnd) {
                $lMap[$cur->format('Y-m-d')] = $lv['leave_type_name'];
                $cur->modify('+1 day');
            }
        }

        // Employee header
        if ($empCount > 0) fputcsv($out, []); // blank separator
        fputcsv($out, ["พนักงาน: {$edEmp['name']} ({$eid})", "แผนก: " . ($edEmp['department'] ?? '-'), "เวลาเข้างาน: " . substr($workStart, 0, 5) . " น."]);
        fputcsv($out, ['วันที่', 'วัน', 'เข้างาน', 'ออกงาน', 'สถานะ', 'สาย (นาที)', 'ชม.ทำงาน', 'หมายเหตุ']);

        // Counters for summary
        $totalPresent = 0; $totalLate = 0; $totalAbsent = 0; $totalLeave = 0; $totalWfh = 0; $totalLateMin = 0; $totalHours = 0;

        // Daily loop
        $cur = new DateTime($startDateD);
        $endDtD = new DateTime($endDateD);
        while ($cur <= $endDtD) {
            $ds = $cur->format('Y-m-d');
            $dow = (int)$cur->format('N');
            $att = $aMap[$ds] ?? null;
            $clockIn = $att['clock_in'] ?? null;
            $clockOut = $att['clock_out'] ?? null;
            $leaveType = $lMap[$ds] ?? null;
            $holidayName = $hdMap[$ds] ?? null;
            $lateMin = 0;
            $wHours = 0;
            $note = '';

            // Schedule-aware, records-driven precedence (replaces hardcoded "$dow > 5"):
            // leave/attendance surface even on off-schedule days; off-schedule + no
            // record stays "weekend".
            $sched = resolve_schedule_for_date($edEmp, $ds, $workIdx);

            if ($holidayName) {
                $status = 'holiday';
                $note = $holidayName;
            } elseif ($leaveType) {
                $isWfh = (stripos($leaveType, 'wfh') !== false || stripos($leaveType, 'work from home') !== false);
                $status = $isWfh ? 'wfh' : 'leave';
                if ($isWfh) $totalWfh++; else $totalLeave++;
                $note = $leaveType;
            } elseif ($att && $clockIn) {
                if (!$sched['active']) {
                    $status = 'offday_work'; // off-schedule day worked → OT candidate
                } else {
                    [$lateFlag, $lateMin] = is_late($clockIn, $sched);
                    if ($lateFlag) {
                        $status = 'late';
                        $totalLate++;
                        $totalLateMin += $lateMin;
                    } else {
                        $status = 'present';
                    }
                    $totalPresent++;
                }
            } elseif (!$sched['active']) {
                $status = 'weekend';
            } elseif ($ds <= $todayD) {
                $status = 'absent';
                $totalAbsent++;
            } else {
                $status = 'future';
            }

            if ($clockIn && $clockOut) {
                // Effective hours on scheduled days, raw on off-schedule worked days
                $wHours = round(day_work_hours($clockIn, $clockOut, $sched), 2);
                $totalHours += $wHours;
            }

            $dateFormatted = $cur->format('d') . '/' . $cur->format('m') . '/' . ((int)$cur->format('Y') + 543);

            fputcsv($out, [
                $dateFormatted,
                $dowNames[$dow],
                $clockIn ? substr($clockIn, 0, 5) : '-',
                $clockOut ? substr($clockOut, 0, 5) : '-',
                $statusLabels[$status] ?? $status,
                $lateMin > 0 ? $lateMin : '',
                $wHours > 0 ? $wHours : '',
                $note,
            ]);
            $cur->modify('+1 day');
        }

        // Employee summary row
        fputcsv($out, [
            'สรุป', '', '', '',
            "มา:{$totalPresent} สาย:{$totalLate} ขาด:{$totalAbsent} ลา:{$totalLeave} WFH:{$totalWfh}",
            $totalLateMin > 0 ? "รวม {$totalLateMin} นาที" : '',
            $totalHours > 0 ? round($totalHours, 1) . ' ชม.' : '',
            '',
        ]);
        $empCount++;
    }

    fclose($out);
    exit;
}

// ─── CSV Export ───
if ($export === 'csv') {
    // BOM for Thai text in Excel
    $bom = "\xEF\xBB\xBF";
    
    $filename = $employee_id 
        ? "attendance_{$employee_id}_{$periodLabel}.csv"
        : "attendance_{$periodLabel}.csv";

    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$filename\"");
    
    $out = fopen('php://output', 'w');
    fwrite($out, $bom);

    // Build dynamic leave type headers
    $leaveHeaders = [];
    foreach ($leaveTypes as $lt) {
        $leaveHeaders[] = $lt['name'] . ' (วัน)';
    }

    // Helper: format minutes as "X ชม. Y นาที" (or just minutes if <60)
    $formatMins = function ($mins) {
        $mins = (int) $mins;
        if ($mins <= 0) return '-';
        if ($mins < 60) return $mins . ' นาที';
        $h = intdiv($mins, 60);
        $m = $mins % 60;
        return $m > 0 ? "{$h} ชม. {$m} นาที" : "{$h} ชม.";
    };

    // CSV header
    $header = array_merge(
        ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'เงินเดือนฐาน', 'เวลาเข้างาน', 'เวลาเลิกงาน',
         'วันทำงานที่ควรมา', 'วันทำงานจริง', 'ขาดงาน (วัน)',
         'สาย (ครั้ง)', 'สาย (เวลา)',
         'กลับก่อน (ครั้ง)', 'กลับก่อน (เวลา)'],
        $leaveHeaders,
        ['ลารวม (วัน)', 'OT (ชม.)', 'ชม.ทำงานรวม', 'เบี้ยขยัน']
    );
    fputcsv($out, $header);

    // CSV rows
    foreach ($report as $row) {
        // Map leave by type to ordered columns
        $leaveMap = [];
        foreach ($row['leave_by_type'] as $lv) {
            $leaveMap[$lv['leave_type_id']] = $lv['days'];
        }
        $leaveCols = [];
        foreach ($leaveTypes as $lt) {
            $leaveCols[] = $leaveMap[$lt['id']] ?? 0;
        }

        $csvRow = array_merge(
            [
                $row['employee_id'],
                $row['employee_name'],
                $row['department'],
                $row['base_salary'],
                $row['work_start_time'],
                $row['work_end_time'] ?? '',
                $row['expected_work_days'],
                $row['actual_work_days'],
                $row['absent_days'],
                $row['late_count'],
                $formatMins($row['late_minutes_total']),
                $row['early_leave_count'] ?? 0,
                $formatMins($row['early_leave_minutes_total'] ?? 0),
            ],
            $leaveCols,
            [
                $row['total_leave_days'],
                $row['ot_hours'],
                $row['total_work_hours'],
                $row['diligence_eligible'] ? 'ได้' : 'ไม่ได้',
            ]
        );
        fputcsv($out, $csvRow);
    }

    fclose($out);
    exit;
}

// ─── JSON Response ───
json_response([
    'period' => $periodLabel,
    'start_date' => $startDate,
    'end_date' => $endDate,
    'expected_work_days' => $expectedWorkDays,
    'full_period_work_days' => $fullPeriodWorkDays,
    'leave_types' => $leaveTypes,
    'departments' => $departments,
    'employees' => $report,
    'summary' => [
        'total_employees' => count($report),
        'total_absent_days' => round(array_sum(array_column($report, 'absent_days')), 2),
        'total_late_count' => array_sum(array_column($report, 'late_count')),
        'total_late_minutes' => round(array_sum(array_column($report, 'late_minutes_total')), 2),
        'total_early_leave_count' => array_sum(array_column($report, 'early_leave_count')),
        'total_early_leave_minutes' => round(array_sum(array_column($report, 'early_leave_minutes_total')), 2),
        'total_leave_days' => round(array_sum(array_column($report, 'total_leave_days')), 2),
        'total_ot_hours' => round(array_sum(array_column($report, 'ot_hours')), 2),
        'diligence_eligible_count' => count(array_filter($report, function($r) { return $r['diligence_eligible']; })),
    ],
]);
