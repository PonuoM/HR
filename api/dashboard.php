<?php
/**
 * Admin Dashboard API (Multi-Company)
 * GET /api/dashboard.php  - Aggregated stats for admin dashboard
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

if ($method === 'GET') {
    // Total employees (filtered by company)
    $stmt = $conn->prepare("SELECT COUNT(*) as c FROM employees WHERE is_active = 1 AND company_id = ?");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $totalEmployees = $stmt->get_result()->fetch_assoc()['c'];

    // On leave today (only employees from this company)
    $today = date('Y-m-d');
    $stmt = $conn->prepare("SELECT COUNT(*) as c FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.status = 'approved' AND lr.start_date <= ? AND lr.end_date >= ? AND e.company_id = ?");
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
    $stmt = $conn->prepare("SELECT lr.*, e.name, e.avatar, d.name AS department, lt.name AS leave_type_name
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
