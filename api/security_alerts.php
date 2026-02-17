<?php
/**
 * Security Alerts API
 * GET    /api/security_alerts.php               - List alerts (superadmin only)
 * PUT    /api/security_alerts.php?id=X           - Resolve an alert
 * DELETE /api/security_alerts.php?employee_id=X  - Reset device binding
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

// Check if caller is superadmin
function require_superadmin($conn) {
    $headers = getallheaders();
    $caller_id = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? null;
    if (!$caller_id) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    $stmt = $conn->prepare("SELECT is_superadmin FROM employees WHERE id = ?");
    $stmt->bind_param('s', $caller_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row || !$row['is_superadmin']) {
        json_response(['error' => 'ต้องเป็น Superadmin เท่านั้น'], 403);
    }
    return $caller_id;
}

// ─── GET: List security alerts ───
if ($method === 'GET') {
    require_superadmin($conn);

    $status = $_GET['status'] ?? 'unresolved'; // 'unresolved', 'resolved', 'all'
    $limit = min((int)($_GET['limit'] ?? 50), 100);

    $sql = "SELECT sa.*, 
            e1.name AS employee_name, 
            e2.name AS original_employee_name,
            e3.name AS resolved_by_name
            FROM security_alerts sa
            LEFT JOIN employees e1 ON sa.employee_id = e1.id
            LEFT JOIN employees e2 ON sa.original_employee_id = e2.id
            LEFT JOIN employees e3 ON sa.resolved_by = e3.id";
    
    if ($status === 'unresolved') {
        $sql .= " WHERE sa.is_resolved = 0";
    } elseif ($status === 'resolved') {
        $sql .= " WHERE sa.is_resolved = 1";
    }
    
    $sql .= " ORDER BY sa.created_at DESC LIMIT $limit";
    
    $result = $conn->query($sql);
    $alerts = [];
    while ($row = $result->fetch_assoc()) {
        $alerts[] = $row;
    }

    json_response($alerts);
}

// ─── PUT: Resolve an alert ───
if ($method === 'PUT' && isset($_GET['id'])) {
    $admin_id = require_superadmin($conn);
    $id = (int)$_GET['id'];

    $stmt = $conn->prepare("UPDATE security_alerts SET is_resolved = 1, resolved_by = ?, resolved_at = NOW() WHERE id = ?");
    $stmt->bind_param('si', $admin_id, $id);
    $stmt->execute();

    json_response(['message' => 'ดำเนินการแก้ไขเรียบร้อย']);
}

// ─── DELETE: Reset device binding for an employee ───
if ($method === 'DELETE' && isset($_GET['employee_id'])) {
    require_superadmin($conn);
    $emp_id = $_GET['employee_id'];

    $stmt = $conn->prepare("UPDATE employees SET device_fingerprint = NULL, device_registered_at = NULL WHERE id = ?");
    $stmt->bind_param('s', $emp_id);
    $stmt->execute();

    json_response(['message' => 'รีเซ็ตอุปกรณ์เรียบร้อย']);
}

json_response(['error' => 'Method not allowed'], 405);
