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

$method = get_method();
if ($method !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

// ─── Parameters ───
$month = $_GET['month'] ?? null;         // e.g. "2026-02"
$year = $_GET['year'] ?? null;           // e.g. "2026"
$employee_id = $_GET['employee_id'] ?? null;
$export = $_GET['export'] ?? null;       // "csv"

if (!$month && !$year) {
    json_response(['error' => 'month or year parameter is required (e.g. month=2026-02 or year=2026)'], 400);
}

// ─── Daily detail for a single employee ───
$action = $_GET['action'] ?? null;
if ($action === 'daily' && $employee_id && $month) {
    $startDate = $month . '-01';
    $endDate = date('Y-m-t', strtotime($startDate));

    // Get employee info
    $empStmt = $conn->prepare("SELECT e.id, e.name, d.name AS department, d.work_start_time, d.work_end_time 
                                FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $emp = $empStmt->get_result()->fetch_assoc();
    if (!$emp) json_response(['error' => 'Employee not found'], 404);

    $workStart = $emp['work_start_time'] ?? '09:00:00';
    $workEnd = $emp['work_end_time'] ?? '17:00:00';

    // Get attendance records indexed by date
    $attMap = [];
    $attStmt = $conn->prepare("SELECT date, clock_in, clock_out FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?");
    $attStmt->bind_param('sss', $employee_id, $startDate, $endDate);
    $attStmt->execute();
    $attRes = $attStmt->get_result();
    while ($a = $attRes->fetch_assoc()) {
        $attMap[$a['date']] = $a;
    }

    // Get holidays indexed by date
    $holidayMap = [];
    $hRes = $conn->query("SELECT date, name FROM holidays WHERE date BETWEEN '$startDate' AND '$endDate'");
    while ($h = $hRes->fetch_assoc()) {
        $holidayMap[$h['date']] = $h['name'];
    }

    // Get approved leaves with dates
    $leaveMap = []; // date => leave info
    $lvStmt = $conn->prepare(
        "SELECT lr.start_date, lr.end_date, lr.total_days, lt.name AS leave_type_name
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = ? AND lr.status = 'approved'
           AND ((lr.start_date BETWEEN ? AND ?) OR (lr.end_date BETWEEN ? AND ?))"
    );
    $lvStmt->bind_param('sssss', $employee_id, $startDate, $endDate, $startDate, $endDate);
    $lvStmt->execute();
    $lvRes = $lvStmt->get_result();
    while ($lv = $lvRes->fetch_assoc()) {
        $cur = new DateTime(max($lv['start_date'], $startDate));
        $lvEnd = new DateTime(min($lv['end_date'], $endDate));
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

        $status = '';
        $clockIn = $att['clock_in'] ?? null;
        $clockOut = $att['clock_out'] ?? null;
        $lateMinutes = 0;
        $leaveType = $leaveMap[$dateStr] ?? null;
        $holidayName = $holidayMap[$dateStr] ?? null;

        if ($dow > 5) {
            $status = 'weekend';
        } elseif ($holidayName) {
            $status = 'holiday';
        } elseif ($leaveType) {
            $status = 'leave';
        } elseif ($att && $clockIn) {
            if ($clockIn > $workStart) {
                $status = 'late';
                $lateMinutes = round((strtotime($clockIn) - strtotime($workStart)) / 60);
            } else {
                $status = 'present';
            }
        } elseif ($dateStr <= $today) {
            $status = 'absent';
        } else {
            $status = 'future';
        }

        // Work hours for the day
        $workHours = 0;
        if ($clockIn && $clockOut) {
            $workHours = round((strtotime($clockOut) - strtotime($clockIn)) / 3600, 2);
        }

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
        ];
        $current->modify('+1 day');
    }

    json_response([
        'employee_id' => $emp['id'],
        'employee_name' => $emp['name'],
        'department' => $emp['department'] ?? '-',
        'work_start_time' => $workStart,
        'work_end_time' => $workEnd,
        'month' => $month,
        'days' => $days,
    ]);
}

// ─── Determine date range ───
if ($month) {
    $startDate = $month . '-01';
    $endDate = date('Y-m-t', strtotime($startDate));
    $periodLabel = $month;
} else {
    $startDate = $year . '-01-01';
    $endDate = $year . '-12-31';
    $periodLabel = $year;
}

// ─── Helper: Count working days (Mon-Fri) minus holidays ───
function getWorkingDays($conn, $start, $end) {
    $holidays = [];
    $hResult = $conn->query("SELECT date FROM holidays WHERE date BETWEEN '$start' AND '$end'");
    while ($h = $hResult->fetch_assoc()) {
        $holidays[] = $h['date'];
    }

    $count = 0;
    $current = new DateTime($start);
    $endDt = new DateTime($end);
    while ($current <= $endDt) {
        $dow = (int)$current->format('N'); // 1=Mon, 7=Sun
        $dateStr = $current->format('Y-m-d');
        if ($dow <= 5 && !in_array($dateStr, $holidays)) {
            $count++;
        }
        $current->modify('+1 day');
    }
    return $count;
}

// ─── Fetch all leave types (for dynamic columns) ───
$leaveTypes = [];
$ltResult = $conn->query("SELECT id, name, type FROM leave_types WHERE is_active = 1 ORDER BY id");
while ($lt = $ltResult->fetch_assoc()) {
    $leaveTypes[] = $lt;
}

// ─── Fetch employees ───
$empWhere = "e.is_active = 1";
$empParams = [];
$empTypes = '';
if ($employee_id) {
    $empWhere .= " AND e.id = ?";
    $empParams[] = $employee_id;
    $empTypes .= 's';
}

$empSql = "SELECT e.id, e.name, e.hire_date, e.base_salary, d.name AS department, d.work_start_time 
           FROM employees e
           LEFT JOIN departments d ON e.department_id = d.id 
           WHERE $empWhere
           ORDER BY d.name, e.name";

if ($empTypes) {
    $empStmt = $conn->prepare($empSql);
    $empStmt->bind_param($empTypes, ...$empParams);
    $empStmt->execute();
    $empResult = $empStmt->get_result();
} else {
    $empResult = $conn->query($empSql);
}

$expectedWorkDays = getWorkingDays($conn, $startDate, $endDate);

$report = [];

while ($emp = $empResult->fetch_assoc()) {
    $eid = $emp['id'];
    $workStart = $emp['work_start_time'] ?? '09:00:00';

    // ── Attendance data ──
    $attSql = "SELECT date, clock_in, clock_out FROM attendance 
               WHERE employee_id = ? AND date BETWEEN ? AND ?";
    $attStmt = $conn->prepare($attSql);
    $attStmt->bind_param('sss', $eid, $startDate, $endDate);
    $attStmt->execute();
    $attResult = $attStmt->get_result();

    $actualWorkDays = 0;
    $lateDays = 0;
    $lateMinutesTotal = 0;
    $totalWorkHours = 0;
    $attendanceDates = [];

    while ($att = $attResult->fetch_assoc()) {
        $actualWorkDays++;
        $attendanceDates[] = $att['date'];

        // Late check
        if ($att['clock_in'] && $att['clock_in'] > $workStart) {
            $lateDays++;
            $startTs = strtotime($workStart);
            $clockTs = strtotime($att['clock_in']);
            $diff = ($clockTs - $startTs) / 60;
            $lateMinutesTotal += max(0, $diff);
        }

        // Work hours
        if ($att['clock_in'] && $att['clock_out']) {
            $inTs = strtotime($att['clock_in']);
            $outTs = strtotime($att['clock_out']);
            $hours = ($outTs - $inTs) / 3600;
            $totalWorkHours += max(0, $hours);
        }
    }

    // ── Leave data (approved only) ──
    $leaveSql = "SELECT lr.leave_type_id, lt.name AS leave_type_name, lt.type AS leave_category, 
                        SUM(lr.total_days) AS total_days
                 FROM leave_requests lr
                 JOIN leave_types lt ON lr.leave_type_id = lt.id
                 WHERE lr.employee_id = ? 
                   AND lr.status = 'approved'
                   AND lr.reason NOT LIKE '[OT]%'
                   AND ((lr.start_date BETWEEN ? AND ?) OR (lr.end_date BETWEEN ? AND ?))
                 GROUP BY lr.leave_type_id, lt.name, lt.type";
    $leaveStmt = $conn->prepare($leaveSql);
    $leaveStmt->bind_param('sssss', $eid, $startDate, $endDate, $startDate, $endDate);
    $leaveStmt->execute();
    $leaveResult = $leaveStmt->get_result();

    $leaveByType = [];
    $totalLeaveDays = 0;
    $nonAnnualLeaveDays = 0; // For เบี้ยขยัน calculation

    while ($lv = $leaveResult->fetch_assoc()) {
        $days = (float)$lv['total_days'];
        $leaveByType[] = [
            'leave_type_id' => (int)$lv['leave_type_id'],
            'leave_type_name' => $lv['leave_type_name'],
            'leave_category' => $lv['leave_category'],
            'days' => $days,
        ];
        $totalLeaveDays += $days;
        if ($lv['leave_category'] !== 'annual') {
            $nonAnnualLeaveDays += $days;
        }
    }

    // ── OT data (approved, reason starts with [OT]) ──
    $otSql = "SELECT SUM(lr.total_days) AS ot_hours
              FROM leave_requests lr
              WHERE lr.employee_id = ? 
                AND lr.status = 'approved'
                AND lr.reason LIKE '[OT]%'
                AND ((lr.start_date BETWEEN ? AND ?) OR (lr.end_date BETWEEN ? AND ?))";
    $otStmt = $conn->prepare($otSql);
    $otStmt->bind_param('sssss', $eid, $startDate, $endDate, $startDate, $endDate);
    $otStmt->execute();
    $otResult = $otStmt->get_result();
    $otRow = $otResult->fetch_assoc();
    $otHours = (float)($otRow['ot_hours'] ?? 0);

    // ── Absent days: expected - actual - leave days ──
    $absentDays = max(0, $expectedWorkDays - $actualWorkDays - $totalLeaveDays);

    // ── เบี้ยขยัน eligibility: no late + no leave (except annual/ลาพักร้อน) + no absent ──
    $diligenceEligible = ($lateDays == 0 && $nonAnnualLeaveDays == 0 && $absentDays == 0);

    $report[] = [
        'employee_id' => $eid,
        'employee_name' => $emp['name'],
        'department' => $emp['department'] ?? '-',
        'base_salary' => (float)($emp['base_salary'] ?? 0),
        'work_start_time' => $workStart,
        'expected_work_days' => $expectedWorkDays,
        'actual_work_days' => $actualWorkDays,
        'absent_days' => $absentDays,
        'late_count' => $lateDays,
        'late_minutes_total' => round($lateMinutesTotal),
        'leave_by_type' => $leaveByType,
        'total_leave_days' => $totalLeaveDays,
        'ot_hours' => $otHours,
        'total_work_hours' => round($totalWorkHours, 2),
        'diligence_eligible' => $diligenceEligible,
    ];
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

    // CSV header
    $header = array_merge(
        ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'เงินเดือนฐาน', 'เวลาเข้างาน',
         'วันทำงานที่ควรมา', 'วันทำงานจริง', 'ขาดงาน (วัน)',
         'สาย (ครั้ง)', 'สาย (นาทีรวม)'],
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
                $row['expected_work_days'],
                $row['actual_work_days'],
                $row['absent_days'],
                $row['late_count'],
                $row['late_minutes_total'],
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
    'leave_types' => $leaveTypes,
    'employees' => $report,
    'summary' => [
        'total_employees' => count($report),
        'total_absent_days' => array_sum(array_column($report, 'absent_days')),
        'total_late_count' => array_sum(array_column($report, 'late_count')),
        'total_late_minutes' => array_sum(array_column($report, 'late_minutes_total')),
        'total_leave_days' => array_sum(array_column($report, 'total_leave_days')),
        'total_ot_hours' => array_sum(array_column($report, 'ot_hours')),
        'diligence_eligible_count' => count(array_filter($report, function($r) { return $r['diligence_eligible']; })),
    ],
]);
