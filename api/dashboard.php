<?php
/**
 * Admin Dashboard API
 * GET /api/dashboard.php  - Aggregated stats for admin dashboard
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    // Total employees
    $totalEmployees = $conn->query("SELECT COUNT(*) as c FROM employees WHERE is_active = 1")->fetch_assoc()['c'];

    // On leave today
    $today = date('Y-m-d');
    $onLeave = $conn->query("SELECT COUNT(*) as c FROM leave_requests WHERE status = 'approved' AND start_date <= '$today' AND end_date >= '$today'")->fetch_assoc()['c'];

    // Pending requests
    $pendingRequests = $conn->query("SELECT COUNT(*) as c FROM leave_requests WHERE status = 'pending'")->fetch_assoc()['c'];

    // Late today (clock_in after 09:00)
    $lateToday = $conn->query("SELECT COUNT(*) as c FROM attendance WHERE date = '$today' AND clock_in > '09:00:00'")->fetch_assoc()['c'];

    $stats = [
        ['title' => 'พนักงานทั้งหมด', 'value' => (string)$totalEmployees, 'unit' => 'คน', 'icon' => 'groups', 'color' => 'blue'],
        ['title' => 'ลางานวันนี้', 'value' => (string)$onLeave, 'unit' => 'คน', 'icon' => 'beach_access', 'color' => 'orange'],
        ['title' => 'คำขอรออนุมัติ', 'value' => (string)$pendingRequests, 'unit' => 'รายการ', 'icon' => 'pending_actions', 'color' => 'red'],
        ['title' => 'เข้างานสาย', 'value' => (string)$lateToday, 'unit' => 'คน', 'icon' => 'timer_off', 'color' => 'purple'],
    ];

    // Pending requests detail
    $pendingSql = "SELECT lr.*, e.name, e.avatar, d.name AS department, lt.name AS leave_type_name
                   FROM leave_requests lr
                   JOIN employees e ON lr.employee_id = e.id
                   LEFT JOIN departments d ON e.department_id = d.id
                   JOIN leave_types lt ON lr.leave_type_id = lt.id
                   WHERE lr.status = 'pending'
                   ORDER BY lr.created_at DESC
                   LIMIT 10";
    $result = $conn->query($pendingSql);
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
