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
    $where = $employee_id ? "WHERE p.employee_id = '$employee_id'" : '';
    $sql = "SELECT p.*, e.name AS employee_name
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
