<?php
/**
 * Employees API (Multi-Company)
 * GET    /api/employees.php          - List all active employees (filtered by company)
 * GET    /api/employees.php?id=X     - Get single employee
 * POST   /api/employees.php          - Create employee
 * PUT    /api/employees.php?id=X     - Update employee
 * DELETE /api/employees.php?id=X     - Delete employee
 * PUT    /api/employees.php?id=X&action=reset_password  - Reset password
 * PUT    /api/employees.php?id=X&action=suspend         - Suspend employee
 * PUT    /api/employees.php?id=X&action=unsuspend       - Unsuspend employee
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

// ======================== GET ========================
if ($method === 'GET') {
    // Single employee
    if (isset($_GET['id'])) {
        $id = $_GET['id'];
        $stmt = $conn->prepare("SELECT e.*, d.name AS department, p.name AS position, p.can_have_subordinates
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN positions p ON e.position_id = p.id
            WHERE e.id = ? AND e.company_id = ?");
        $stmt->bind_param('si', $id, $company_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $employee = $result->fetch_assoc();
        if (!$employee) {
            json_response(['error' => 'Employee not found'], 404);
        }
        $employee['is_admin'] = (int)$employee['is_admin'];
        $employee['is_active'] = (int)$employee['is_active'];
        // Get subordinates
        $subStmt = $conn->prepare("SELECT id, name, avatar FROM employees WHERE approver_id = ? AND is_active = 1 AND company_id = ?");
        $subStmt->bind_param('si', $id, $company_id);
        $subStmt->execute();
        $subResult = $subStmt->get_result();
        $subordinates = [];
        while ($sub = $subResult->fetch_assoc()) {
            $subordinates[] = $sub;
        }
        $employee['subordinates'] = $subordinates;
        json_response($employee);
    }

    // List all employees
    $show_inactive = isset($_GET['show_inactive']) && $_GET['show_inactive'] === '1';
    $where = $show_inactive ? "e.company_id = ?" : "e.is_active = 1 AND e.company_id = ?";

    $stmt = $conn->prepare("SELECT e.id, e.name, e.email, e.avatar, e.is_admin, e.is_active, e.employment_type,
                   e.approver_id, e.approver2_id, e.base_salary, e.hire_date, e.terminated_at,
                   d.name AS department, d.id AS department_id,
                   p.name AS position, p.id AS position_id, p.can_have_subordinates,
                   a.name AS approver_name, a2.name AS approver2_name
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN positions p ON e.position_id = p.id
            LEFT JOIN employees a ON e.approver_id = a.id
            LEFT JOIN employees a2 ON e.approver2_id = a2.id
            WHERE $where
            ORDER BY e.name");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $employees = [];
    while ($row = $result->fetch_assoc()) {
        $row['is_admin'] = (int)$row['is_admin'];
        $row['is_active'] = (int)$row['is_active'];
        $employees[] = $row;
    }
    json_response($employees);
}

// ======================== POST (Create) ========================
if ($method === 'POST') {
    $body = get_json_body();
    $id = $conn->real_escape_string($body['id'] ?? '');
    $name = $conn->real_escape_string($body['name'] ?? '');
    $email = $body['email'] ?? '';
    $password = $body['password'] ?? '1234';
    $department_id = isset($body['department_id']) ? (int)$body['department_id'] : null;
    $position_id = isset($body['position_id']) ? (int)$body['position_id'] : null;
    $base_salary = isset($body['base_salary']) ? (float)$body['base_salary'] : null;
    $hire_date = !empty($body['hire_date']) ? $body['hire_date'] : null;
    $approver_id = !empty($body['approver_id']) ? $body['approver_id'] : null;

    // Check if caller is superadmin (needed for company_id override and is_admin)
    $is_caller_superadmin = false;
    $headers = getallheaders();
    $caller_id = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? null;
    if ($caller_id) {
        $saCheck = $conn->prepare("SELECT is_superadmin FROM employees WHERE id = ?");
        $saCheck->bind_param('s', $caller_id);
        $saCheck->execute();
        $saRow = $saCheck->get_result()->fetch_assoc();
        if ($saRow && $saRow['is_superadmin']) {
            $is_caller_superadmin = true;
        }
    }

    // Superadmin can override company_id
    $target_company_id = $company_id;
    if (!empty($body['company_id']) && $is_caller_superadmin) {
        $target_company_id = (int)$body['company_id'];
    }

    if (!$id || !$name) {
        json_response(['error' => 'id and name are required'], 400);
    }

    // Check duplicate
    $checkStmt = $conn->prepare("SELECT id FROM employees WHERE id = ?");
    $checkStmt->bind_param('s', $id);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        json_response(['error' => 'รหัสพนักงานนี้ถูกใช้งานแล้ว'], 409);
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $is_admin = (!empty($body['is_admin']) && $is_caller_superadmin) ? 1 : 0;

    $stmt = $conn->prepare("INSERT INTO employees (id, company_id, name, email, password, department_id, position_id, base_salary, hire_date, approver_id, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sisssiidssi',
        $id, $target_company_id, $name, $email, $hashedPassword,
        $department_id, $position_id, $base_salary, $hire_date, $approver_id, $is_admin
    );
    $stmt->execute();
    json_response(['message' => 'Employee created', 'id' => $id], 201);
}

// ======================== PUT (Update) ========================
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = $_GET['id'];
    $action = $_GET['action'] ?? null;

    // Reset password
    if ($action === 'reset_password') {
        $newHash = password_hash('1234', PASSWORD_BCRYPT);
        $stmt = $conn->prepare("UPDATE employees SET password = ? WHERE id = ? AND company_id = ?");
        $stmt->bind_param('ssi', $newHash, $id, $company_id);
        $stmt->execute();
        json_response(['message' => 'Password reset to 1234']);
    }

    // Suspend
    if ($action === 'suspend') {
        $body = get_json_body();
        $terminated_at = $body['terminated_at'] ?? date('Y-m-d');
        $stmt = $conn->prepare("UPDATE employees SET is_active = 0, terminated_at = ? WHERE id = ? AND company_id = ?");
        $stmt->bind_param('ssi', $terminated_at, $id, $company_id);
        $stmt->execute();
        json_response(['message' => 'Employee suspended']);
    }

    // Unsuspend
    if ($action === 'unsuspend') {
        $stmt = $conn->prepare("UPDATE employees SET is_active = 1, terminated_at = NULL WHERE id = ? AND company_id = ?");
        $stmt->bind_param('si', $id, $company_id);
        $stmt->execute();
        json_response(['message' => 'Employee unsuspended']);
    }

    // General update — only update fields that are actually sent
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !is_array($body)) {
        json_response(['error' => 'Invalid request body'], 400);
    }

    // Map of allowed fields => SQL type for bind_param
    $allowed = [
        'name'          => 's',
        'email'         => 's',
        'department_id' => 'i',
        'position_id'   => 'i',
        'base_salary'   => 'd',
        'hire_date'     => 's',
        'approver_id'   => 's',
        'approver2_id'  => 's',
        'avatar'        => 's',
        'employment_type' => 's',
        'is_admin'      => 'i',
    ];

    $setClauses = [];
    $types = '';
    $values = [];

    foreach ($allowed as $field => $type) {
        if (array_key_exists($field, $body)) {
            $val = $body[$field];
            // Handle empty strings for nullable fields
            if (in_array($field, ['department_id', 'position_id', 'base_salary', 'hire_date', 'approver_id', 'approver2_id']) && ($val === '' || $val === null)) {
                $val = null;
            }
            $setClauses[] = "$field = ?";
            $types .= $type;
            $values[] = $val;
        }
    }

    if (empty($setClauses)) {
        json_response(['error' => 'No fields to update'], 400);
    }

    $sql = "UPDATE employees SET " . implode(', ', $setClauses) . " WHERE id = ? AND company_id = ?";
    $types .= 'si';
    $values[] = $id;
    $values[] = $company_id;

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    $stmt->execute();
    json_response(['message' => 'Employee updated', 'id' => $id]);
}

// ======================== DELETE ========================
if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = $_GET['id'];
    $stmt = $conn->prepare("DELETE FROM employees WHERE id = ? AND company_id = ?");
    $stmt->bind_param('si', $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Employee deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
