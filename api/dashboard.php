<?php
/**
 * Admin Dashboard API (Multi-Company)
 * GET /api/dashboard.php  - Aggregated stats for admin dashboard
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/schedule_helper.php';

$method = get_method();
$company_id = get_company_id();

// ─── GET ?action=clock_status: Live clock-in/out status for all employees ───
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'clock_status') {
    $today = date('Y-m-d');
    $departmentId = isset($_GET['department_id']) ? (int)$_GET['department_id'] : null;

    // Build employee query with optional department filter (incl. fields for schedule resolver)
    $empSql = "SELECT e.id, CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS name,
                      e.nickname, e.avatar,
                      e.schedule_json, e.late_grace_minutes,
                      d.name AS department, d.id AS department_id,
                      d.work_start_time, d.work_end_time,
                      d.schedule_json AS dept_schedule_json,
                      d.late_grace_minutes AS dept_late_grace_minutes,
                      d.work_start_time AS dept_work_start_time,
                      d.work_end_time AS dept_work_end_time
               FROM employees e
               LEFT JOIN departments d ON e.department_id = d.id
               WHERE e.is_active = 1 AND e.company_id = ?";
    $types = 'i';
    $params = [$company_id];

    if ($departmentId) {
        $empSql .= " AND e.department_id = ?";
        $types .= 'i';
        $params[] = $departmentId;
    }
    $empSql .= " ORDER BY d.name, e.name";

    $stmt = $conn->prepare($empSql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $empResult = $stmt->get_result();

    // Get today's attendance records (keyed by employee_id)
    $attMap = [];
    $attStmt = $conn->prepare("SELECT a.employee_id, a.clock_in, a.clock_out, a.location_name, a.is_offsite
                               FROM attendance a
                               JOIN employees e ON a.employee_id = e.id
                               WHERE a.date = ? AND e.company_id = ?");
    $attStmt->bind_param('si', $today, $company_id);
    $attStmt->execute();
    $attRes = $attStmt->get_result();
    while ($att = $attRes->fetch_assoc()) {
        $attMap[$att['employee_id']] = $att;
    }

    // Get today's approved leaves (keyed by employee_id)
    $leaveMap = [];
    $lvStmt = $conn->prepare("SELECT lr.employee_id
                              FROM leave_requests lr
                              JOIN employees e ON lr.employee_id = e.id
                              WHERE lr.status = 'approved' AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ? AND e.company_id = ?");
    $lvStmt->bind_param('ssi', $today, $today, $company_id);
    $lvStmt->execute();
    $lvRes = $lvStmt->get_result();
    while ($lv = $lvRes->fetch_assoc()) {
        $leaveMap[$lv['employee_id']] = true;
    }

    $employees = [];
    $summary = ['total' => 0, 'clocked_in' => 0, 'not_clocked_in' => 0, 'completed' => 0, 'on_leave' => 0, 'late' => 0];

    while ($emp = $empResult->fetch_assoc()) {
        $eid = $emp['id'];
        $att = $attMap[$eid] ?? null;
        $isOnLeave = isset($leaveMap[$eid]);
        // Resolve today's schedule (respects per-employee override + alternating weeks)
        $sched = resolve_schedule_for_date($emp, $today);
        $workStart = $sched['in'] ? $sched['in'] . ':00' : ($emp['work_start_time'] ?? '09:00:00');

        if ($isOnLeave && !$att) {
            $status = 'on_leave';
            $summary['on_leave']++;
        } elseif (!$att) {
            $status = 'not_clocked_in';
            $summary['not_clocked_in']++;
        } elseif ($att['clock_in'] && $att['clock_out']) {
            $status = 'completed';
            $summary['completed']++;
        } else {
            $status = 'clocked_in';
            $summary['clocked_in']++;
        }

        // Check late using schedule-aware grace period
        $isLate = false;
        if ($att && $att['clock_in'] && $sched['active']) {
            [$lateFlag, $_] = is_late($att['clock_in'], $sched);
            if ($lateFlag) {
                $isLate = true;
                $summary['late']++;
            }
        }

        $employees[] = [
            'employee_id' => $eid,
            'name' => $emp['name'],
            'nickname' => $emp['nickname'] ?? null,
            'avatar' => $emp['avatar'],
            'department' => $emp['department'] ?? '-',
            'department_id' => $emp['department_id'],
            'status' => $status,
            'clock_in' => $att['clock_in'] ?? null,
            'clock_out' => $att['clock_out'] ?? null,
            'location_name' => $att['location_name'] ?? null,
            'is_offsite' => $att ? (bool)$att['is_offsite'] : false,
            'is_late' => $isLate,
            'work_start_time' => $workStart,
        ];

        $summary['total']++;
    }

    // Get departments list for filter dropdown
    $deptStmt = $conn->prepare("SELECT DISTINCT d.id, d.name FROM departments d
                                JOIN employees e ON e.department_id = d.id
                                WHERE e.is_active = 1 AND e.company_id = ?
                                ORDER BY d.name");
    $deptStmt->bind_param('i', $company_id);
    $deptStmt->execute();
    $deptRes = $deptStmt->get_result();
    $departments = [];
    while ($d = $deptRes->fetch_assoc()) {
        $departments[] = $d;
    }

    json_response([
        'employees' => $employees,
        'summary' => $summary,
        'departments' => $departments,
        'date' => $today,
    ]);
}

if ($method === 'GET') {
    // Total employees (filtered by company)
    $stmt = $conn->prepare("SELECT COUNT(*) as c FROM employees WHERE is_active = 1 AND company_id = ?");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $totalEmployees = $stmt->get_result()->fetch_assoc()['c'];

    // On leave today (only employees from this company)
    $today = date('Y-m-d');
    $stmt = $conn->prepare("SELECT COUNT(*) as c FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.status = 'approved' AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ? AND e.company_id = ?");
    $stmt->bind_param('ssi', $today, $today, $company_id);
    $stmt->execute();
    $onLeave = $stmt->get_result()->fetch_assoc()['c'];

    // Pending requests (only from company employees)
    $stmt = $conn->prepare("SELECT COUNT(*) as c FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.status = 'pending' AND e.company_id = ?");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $pendingRequests = $stmt->get_result()->fetch_assoc()['c'];

    // Late today (clock_in after 09:00, only company employees)
    $stmt = $conn->prepare("SELECT COUNT(*) as c FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.date = ? AND a.clock_in > '09:00:00' AND e.company_id = ?");
    $stmt->bind_param('si', $today, $company_id);
    $stmt->execute();
    $lateToday = $stmt->get_result()->fetch_assoc()['c'];

    $stats = [
        ['title' => 'พนักงานทั้งหมด', 'value' => (string)$totalEmployees, 'unit' => 'คน', 'icon' => 'groups', 'color' => 'blue'],
        ['title' => 'ลางานวันนี้', 'value' => (string)$onLeave, 'unit' => 'คน', 'icon' => 'beach_access', 'color' => 'orange'],
        ['title' => 'คำขอรออนุมัติ', 'value' => (string)$pendingRequests, 'unit' => 'รายการ', 'icon' => 'pending_actions', 'color' => 'red'],
        ['title' => 'เข้างานสาย', 'value' => (string)$lateToday, 'unit' => 'คน', 'icon' => 'timer_off', 'color' => 'purple'],
    ];

    // Pending requests detail (only from company employees)
    $stmt = $conn->prepare("SELECT lr.*, CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS name, e.avatar, d.name AS department, lt.name AS leave_type_name
                   FROM leave_requests lr
                   JOIN employees e ON lr.employee_id = e.id
                   LEFT JOIN departments d ON e.department_id = d.id
                   JOIN leave_types lt ON lr.leave_type_id = lt.id
                   WHERE lr.status = 'pending' AND e.company_id = ?
                   ORDER BY lr.created_at DESC
                   LIMIT 10");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $pending = [];
    while ($row = $result->fetch_assoc()) {
        $pending[] = $row;
    }

    json_response([
        'stats' => $stats,
        'pendingRequests' => $pending,
    ]);
}

json_response(['error' => 'Method not allowed'], 405);
