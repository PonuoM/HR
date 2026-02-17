<?php
/**
 * Calendar API
 * GET /api/calendar.php?employee_id=X&year=2026&month=2
 * Returns holidays, attendance, leaves, missed days, and partial attendance for the given month.
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

if ($method === 'GET') {
    $employee_id = $conn->real_escape_string($_GET['employee_id'] ?? 'EMP001');
    $year = (int)($_GET['year'] ?? date('Y'));
    $month = (int)($_GET['month'] ?? date('n'));

    $startDate = sprintf('%04d-%02d-01', $year, $month);
    $endDate = date('Y-m-t', strtotime($startDate));
    $todayStr = date('Y-m-d');

    // Get employee hire_date
    $hireDate = null;
    $hStmt = $conn->prepare("SELECT hire_date FROM employees WHERE id = ?");
    $hStmt->bind_param('s', $employee_id);
    $hStmt->execute();
    $hResult = $hStmt->get_result();
    if ($hRow = $hResult->fetch_assoc()) {
        $hireDate = $hRow['hire_date'];
    }

    // 1. Holidays (filtered by company)
    $holidays = [];
    $holidayDates = [];
    $hStmt2 = $conn->prepare("SELECT date, name FROM holidays WHERE company_id = ? AND date BETWEEN ? AND ? ORDER BY date");
    $hStmt2->bind_param('iss', $company_id, $startDate, $endDate);
    $hStmt2->execute();
    $result = $hStmt2->get_result();
    while ($row = $result->fetch_assoc()) {
        $holidays[] = $row;
        $holidayDates[$row['date']] = true;
    }

    // 2. Attendance (indexed by date)
    $attendance = [];
    $attendanceMap = [];
    $sql = "SELECT date, clock_in, clock_out, location FROM attendance 
            WHERE employee_id = '$employee_id' AND date BETWEEN '$startDate' AND '$endDate' 
            ORDER BY date";
    $result = $conn->query($sql);
    while ($row = $result->fetch_assoc()) {
        $attendance[] = $row;
        $attendanceMap[$row['date']] = $row;
    }

    // 3. Leave requests (approved + pending) — expand date ranges
    $leaves = [];
    $leaveDates = [];
    $sql = "SELECT lr.start_date, lr.end_date, lr.status, lr.total_days,
                   lt.name AS leave_type, lt.color
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.employee_id = '$employee_id'
              AND lr.status IN ('approved', 'pending')
              AND lr.start_date <= '$endDate'
              AND lr.end_date >= '$startDate'
            ORDER BY lr.start_date";
    $result = $conn->query($sql);
    while ($row = $result->fetch_assoc()) {
        $cur = max($row['start_date'], $startDate);
        $end = min($row['end_date'], $endDate);
        while ($cur <= $end) {
            $leaves[] = [
                'date' => $cur,
                'leave_type' => $row['leave_type'],
                'color' => $row['color'],
                'status' => $row['status'],
            ];
            $leaveDates[$cur] = true;
            $cur = date('Y-m-d', strtotime($cur . ' +1 day'));
        }
    }

    // 4. Compute missed days (Mon-Fri, no attendance, no holiday, no leave, past dates only)
    $missed = [];
    $partial = [];
    // Start from hire_date if it's within this month (skip days before employee started)
    $missedStart = $startDate;
    if ($hireDate && $hireDate > $startDate) {
        $missedStart = $hireDate;
    }
    $cur = $missedStart;
    while ($cur <= $endDate && $cur <= $todayStr) {
        $dow = (int)date('w', strtotime($cur)); // 0=Sun, 6=Sat

        // Mon-Fri (dow 1-5): flag as missed if no attendance, no holiday, no leave
        if ($dow >= 1 && $dow <= 5) {
            if (!isset($attendanceMap[$cur]) && !isset($holidayDates[$cur]) && !isset($leaveDates[$cur])) {
                $missed[] = $cur;
            }
        }

        // Any day with partial attendance (clock_in but no clock_out, or vice versa)
        if (isset($attendanceMap[$cur])) {
            $a = $attendanceMap[$cur];
            $hasIn = !empty($a['clock_in']);
            $hasOut = !empty($a['clock_out']);
            if ($hasIn && !$hasOut && $cur < $todayStr) {
                // Clock in but no clock out (only flag if not today)
                $partial[] = ['date' => $cur, 'issue' => 'no_clock_out'];
            } elseif (!$hasIn && $hasOut) {
                $partial[] = ['date' => $cur, 'issue' => 'no_clock_in'];
            }
        }

        $cur = date('Y-m-d', strtotime($cur . ' +1 day'));
    }

    json_response([
        'holidays' => $holidays,
        'attendance' => $attendance,
        'leaves' => $leaves,
        'missed' => $missed,
        'partial' => $partial,
    ]);
}

json_response(['error' => 'Method not allowed'], 405);
