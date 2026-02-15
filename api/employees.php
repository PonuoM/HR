<?php
/**
 * Employees API
 * GET /api/employees.php          - List all employees
 * GET /api/employees.php?id=X     - Get single employee
 * GET /api/employees.php?me=1     - Get current logged-in user (session)
 */
require_once __DIR__ . '/config.php';

$method = get_method();

// Create new employee
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $id = trim($body['id'] ?? '');
    $name = trim($body['name'] ?? '');
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '1234';
    $department_id = isset($body['department_id']) && $body['department_id'] ? intval($body['department_id']) : null;
    $position_id = isset($body['position_id']) && $body['position_id'] ? intval($body['position_id']) : null;
    $base_salary = isset($body['base_salary']) && $body['base_salary'] !== '' ? floatval($body['base_salary']) : null;
    $hire_date = isset($body['hire_date']) && $body['hire_date'] ? $body['hire_date'] : null;
    $approver_id = isset($body['approver_id']) && $body['approver_id'] ? $body['approver_id'] : null;

    if (!$id) json_response(['error' => 'กรุณาระบุรหัสพนักงาน'], 400);
    if (!$name) json_response(['error' => 'กรุณาระบุชื่อพนักงาน'], 400);

    // Check duplicate ID
    $check = $conn->prepare("SELECT id FROM employees WHERE id = ?");
    $check->bind_param('s', $id);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        json_response(['error' => 'รหัสพนักงานนี้มีอยู่แล้ว'], 400);
    }

    $hashed = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $conn->prepare("INSERT INTO employees (id, name, email, password, department_id, position_id, base_salary, hire_date, approver_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
    $stmt->bind_param('ssssiidss', $id, $name, $email, $hashed, $department_id, $position_id, $base_salary, $hire_date, $approver_id);
    $stmt->execute();

    if ($stmt->affected_rows > 0) {
        json_response(['message' => 'Employee created', 'id' => $id], 201);
    } else {
        json_response(['error' => 'ไม่สามารถสร้างพนักงานได้: ' . $conn->error], 500);
    }
}

if ($method === 'GET') {
    // Single employee by ID
    if (isset($_GET['id'])) {
        $id = $conn->real_escape_string($_GET['id']);
        $sql = "SELECT e.*, e.terminated_at, d.name AS department, p.name AS position,
                       d.work_start_time, d.work_end_time, d.work_hours_per_day,
                       d.is_admin_system, p.can_have_subordinates,
                       approver.name AS approver_name,
                       approver2.name AS approver2_name
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                LEFT JOIN positions p ON e.position_id = p.id
                LEFT JOIN employees approver ON e.approver_id = approver.id
                LEFT JOIN employees approver2 ON e.approver2_id = approver2.id
                WHERE e.id = '$id'";
        $result = $conn->query($sql);
        if ($row = $result->fetch_assoc()) {
            json_response($row);
        } else {
            json_response(['error' => 'Employee not found'], 404);
        }
    }

    // List all employees
    $sql = "SELECT e.id, e.name, e.email, e.avatar, e.employment_type, e.base_salary, e.hire_date, e.is_admin, e.is_active, e.terminated_at,
                   e.department_id, e.position_id, e.approver_id, e.approver2_id,
                   d.name AS department, d.is_admin_system,
                   p.name AS position, p.can_have_subordinates,
                   approver.name AS approver_name,
                   approver2.name AS approver2_name
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN positions p ON e.position_id = p.id
            LEFT JOIN employees approver ON e.approver_id = approver.id
            LEFT JOIN employees approver2 ON e.approver2_id = approver2.id
            ORDER BY e.id";
    $result = $conn->query($sql);
    $employees = [];
    while ($row = $result->fetch_assoc()) {
        $employees[] = $row;
    }
    json_response($employees);
}

// Reset password (Admin only)
if ($method === 'PUT' && isset($_GET['id']) && isset($_GET['action']) && $_GET['action'] === 'reset_password') {
    $id = $conn->real_escape_string($_GET['id']);
    $defaultPassword = password_hash('1234', PASSWORD_BCRYPT);
    $stmt = $conn->prepare("UPDATE employees SET password = ? WHERE id = ?");
    $stmt->bind_param('ss', $defaultPassword, $id);
    $stmt->execute();
    if ($stmt->affected_rows > 0) {
        json_response(['message' => 'Password reset to 1234', 'employee_id' => $id]);
    } else {
        json_response(['error' => 'Employee not found'], 404);
    }
}

// Update employee info
if ($method === 'PUT' && isset($_GET['id']) && !isset($_GET['action'])) {
    $id = $conn->real_escape_string($_GET['id']);
    $body = json_decode(file_get_contents('php://input'), true);

    // If only updating avatar
    if (isset($body['avatar']) && count($body) === 1) {
        $avatar = $conn->real_escape_string($body['avatar']);
        $stmt = $conn->prepare("UPDATE employees SET avatar = ? WHERE id = ?");
        $stmt->bind_param('ss', $avatar, $id);
        $stmt->execute();
        json_response(['message' => 'Avatar updated', 'employee_id' => $id]);
    }

    $name = $conn->real_escape_string($body['name'] ?? '');
    $email = $conn->real_escape_string($body['email'] ?? '');
    $department_id = intval($body['department_id'] ?? 0);
    $position_id = intval($body['position_id'] ?? 0);
    $base_salary = isset($body['base_salary']) ? floatval($body['base_salary']) : null;
    $hire_date = isset($body['hire_date']) && $body['hire_date'] ? $conn->real_escape_string($body['hire_date']) : null;
    $avatar = isset($body['avatar']) ? $conn->real_escape_string($body['avatar']) : null;
    $approver_id = isset($body['approver_id']) ? ($body['approver_id'] ? $conn->real_escape_string($body['approver_id']) : null) : 'SKIP';
    $approver2_id = isset($body['approver2_id']) ? ($body['approver2_id'] ? $conn->real_escape_string($body['approver2_id']) : null) : 'SKIP';

    $sets = "name = ?, email = ?, department_id = ?, position_id = ?, base_salary = ?, hire_date = ?, avatar = ?";
    $types = 'ssiidss';
    $params = [$name, $email, $department_id, $position_id, $base_salary, $hire_date, $avatar];

    if ($approver_id !== 'SKIP') {
        $sets .= ", approver_id = ?";
        $types .= 's';
        $params[] = $approver_id;
    }
    if ($approver2_id !== 'SKIP') {
        $sets .= ", approver2_id = ?";
        $types .= 's';
        $params[] = $approver2_id;
    }

    $sets .= " WHERE id = ?";
    $types .= 's';
    $params[] = $id;

    $stmt = $conn->prepare("UPDATE employees SET $sets");
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    if ($stmt->affected_rows >= 0) {
        json_response(['message' => 'Employee updated', 'employee_id' => $id]);
    } else {
        json_response(['error' => 'Employee not found'], 404);
    }
}

// Suspend employee (with terminated_at date)
if ($method === 'PUT' && isset($_GET['id']) && isset($_GET['action']) && $_GET['action'] === 'suspend') {
    $id = $conn->real_escape_string($_GET['id']);
    $body = json_decode(file_get_contents('php://input'), true);
    $terminated_at = isset($body['terminated_at']) && $body['terminated_at'] ? $conn->real_escape_string($body['terminated_at']) : null;

    $stmt = $conn->prepare("UPDATE employees SET is_active = 0, terminated_at = ? WHERE id = ?");
    $stmt->bind_param('ss', $terminated_at, $id);
    $stmt->execute();
    if ($stmt->affected_rows >= 0) {
        json_response(['message' => 'Employee suspended', 'employee_id' => $id]);
    } else {
        json_response(['error' => 'Employee not found'], 404);
    }
}

// Unsuspend (reactivate) employee
if ($method === 'PUT' && isset($_GET['id']) && isset($_GET['action']) && $_GET['action'] === 'unsuspend') {
    $id = $conn->real_escape_string($_GET['id']);
    $stmt = $conn->prepare("UPDATE employees SET is_active = 1, terminated_at = NULL WHERE id = ?");
    $stmt->bind_param('s', $id);
    $stmt->execute();
    if ($stmt->affected_rows >= 0) {
        json_response(['message' => 'Employee reactivated', 'employee_id' => $id]);
    } else {
        json_response(['error' => 'Employee not found'], 404);
    }
}

// Soft-delete (deactivate) employee - legacy fallback
if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = $conn->real_escape_string($_GET['id']);
    $stmt = $conn->prepare("UPDATE employees SET is_active = 0 WHERE id = ?");
    $stmt->bind_param('s', $id);
    $stmt->execute();
    if ($stmt->affected_rows > 0) {
        json_response(['message' => 'Employee deactivated', 'employee_id' => $id]);
    } else {
        json_response(['error' => 'Employee not found'], 404);
    }
}

json_response(['error' => 'Method not allowed'], 405);
