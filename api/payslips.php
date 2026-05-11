<?php
/**
 * Payslips API
 * GET  /api/payslips.php?employee_id=X  - List payslips for employee
 * POST /api/payslips.php                - Admin sends payslip
 * PUT  /api/payslips.php?id=X           - Mark payslip as read
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    $employee_id = $conn->real_escape_string($_GET['employee_id'] ?? '');
    $caller_id = get_employee_id();
    
    // Non-admin users can only see their own payslips
    if ($employee_id && $caller_id && $employee_id !== $caller_id) {
        // Check if caller is admin
        $adminCheck = $conn->prepare("SELECT is_admin, is_superadmin FROM employees WHERE id = ?");
        $adminCheck->bind_param('s', $caller_id);
        $adminCheck->execute();
        $adminRow = $adminCheck->get_result()->fetch_assoc();
        if (!$adminRow || (!$adminRow['is_admin'] && !$adminRow['is_superadmin'])) {
            json_response(['error' => 'ไม่มีสิทธิ์ดูข้อมูลเงินเดือนของผู้อื่น'], 403);
        }
    }
    
    $where = $employee_id ? "WHERE p.employee_id = '$employee_id'" : '';
    $sql = "SELECT p.*, CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS employee_name
            FROM payslips p
            JOIN employees e ON p.employee_id = e.id
            $where
            ORDER BY p.sent_at DESC";
    $result = $conn->query($sql);
    $payslips = [];
    while ($row = $result->fetch_assoc()) {
        $payslips[] = $row;
    }
    json_response($payslips);
}

if ($method === 'POST') {
    require_admin($conn);
    $body = get_json_body();
    $stmt = $conn->prepare("INSERT INTO payslips (employee_id, month, year, amount, image_url) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param('sssss',
        $body['employee_id'], $body['month'], $body['year'],
        $body['amount'], $body['image_url']
    );
    $stmt->execute();
    json_response(['id' => $conn->insert_id, 'message' => 'Created'], 201);
}

if ($method === 'PUT' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $conn->query("UPDATE payslips SET status = 'read' WHERE id = $id");
    json_response(['message' => 'Marked as read']);
}

json_response(['error' => 'Method not allowed'], 405);

