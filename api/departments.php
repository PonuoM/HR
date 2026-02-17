<?php
/**
 * Departments & Positions API (Multi-Company)
 * GET    /api/departments.php                    - List departments
 * GET    /api/departments.php?type=positions     - List positions
 * POST   /api/departments.php                    - Create department
 * POST   /api/departments.php?type=positions     - Create position
 * PUT    /api/departments.php?id=X               - Update department
 * PUT    /api/departments.php?type=positions&id=X - Update position
 * DELETE /api/departments.php?id=X               - Delete department
 * DELETE /api/departments.php?type=positions&id=X - Delete position
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$type = $_GET['type'] ?? 'departments';
$company_id = get_company_id();

// ======================== GET ========================
if ($method === 'GET') {
    if ($type === 'positions') {
        $stmt = $conn->prepare("SELECT * FROM positions WHERE company_id = ? ORDER BY id");
        $stmt->bind_param('i', $company_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $row['can_have_subordinates'] = (int)($row['can_have_subordinates'] ?? 0);
            $items[] = $row;
        }
        json_response($items);
    }

    // Default: departments
    $stmt = $conn->prepare("SELECT * FROM departments WHERE company_id = ? ORDER BY id");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $row['is_admin_system'] = (int)($row['is_admin_system'] ?? 0);
        $items[] = $row;
    }
    json_response($items);
}

// ======================== POST (Create) ========================
if ($method === 'POST') {
    $body = get_json_body();

    if ($type === 'positions') {
        $name = $conn->real_escape_string($body['name'] ?? '');
        $can_sub = isset($body['can_have_subordinates']) ? intval($body['can_have_subordinates']) : 0;

        if (!$name) json_response(['error' => 'Name is required'], 400);

        $stmt = $conn->prepare("INSERT INTO positions (company_id, name, can_have_subordinates) VALUES (?, ?, ?)");
        $stmt->bind_param('isi', $company_id, $name, $can_sub);
        $stmt->execute();
        json_response(['id' => $conn->insert_id, 'message' => 'Position created'], 201);
    }

    // Default: create department
    $name = $conn->real_escape_string($body['name'] ?? '');
    $work_start = $body['work_start_time'] ?? '09:00:00';
    $work_end = $body['work_end_time'] ?? '17:00:00';
    $is_admin = isset($body['is_admin_system']) ? intval($body['is_admin_system']) : 0;

    if (!$name) json_response(['error' => 'Name is required'], 400);

    // Auto-calculate work hours
    $sp = explode(':', $work_start);
    $ep = explode(':', $work_end);
    $work_hours = round((intval($ep[0]) * 60 + intval($ep[1] ?? 0) - intval($sp[0]) * 60 - intval($sp[1] ?? 0)) / 60, 2);
    if ($work_hours <= 0) $work_hours = 8;

    $stmt = $conn->prepare("INSERT INTO departments (company_id, name, work_start_time, work_end_time, work_hours_per_day, is_admin_system) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('isssdi', $company_id, $name, $work_start, $work_end, $work_hours, $is_admin);
    $stmt->execute();
    json_response(['id' => $conn->insert_id, 'message' => 'Department created'], 201);
}

// ======================== PUT (Update) ========================
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $body = json_decode(file_get_contents('php://input'), true);

    if ($type === 'positions') {
        $name = $conn->real_escape_string($body['name'] ?? '');
        $can_sub = isset($body['can_have_subordinates']) ? intval($body['can_have_subordinates']) : 0;

        $stmt = $conn->prepare("UPDATE positions SET name = ?, can_have_subordinates = ? WHERE id = ? AND company_id = ?");
        $stmt->bind_param('siii', $name, $can_sub, $id, $company_id);
        $stmt->execute();
        json_response(['message' => 'Position updated', 'id' => $id]);
    }

    // Default: update department
    $name = $conn->real_escape_string($body['name'] ?? '');
    $work_start = $conn->real_escape_string($body['work_start_time'] ?? '09:00:00');
    $work_end = $conn->real_escape_string($body['work_end_time'] ?? '17:00:00');
    $is_admin = isset($body['is_admin_system']) ? intval($body['is_admin_system']) : 0;

    $sp = explode(':', $work_start);
    $ep = explode(':', $work_end);
    $work_hours = round((intval($ep[0]) * 60 + intval($ep[1] ?? 0) - intval($sp[0]) * 60 - intval($sp[1] ?? 0)) / 60, 2);
    if ($work_hours <= 0) $work_hours = 8;

    $stmt = $conn->prepare("UPDATE departments SET name = ?, work_start_time = ?, work_end_time = ?, work_hours_per_day = ?, is_admin_system = ? WHERE id = ? AND company_id = ?");
    $stmt->bind_param('sssdiii', $name, $work_start, $work_end, $work_hours, $is_admin, $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Department updated', 'id' => $id, 'work_hours_per_day' => $work_hours]);
}

// ======================== DELETE ========================
if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = intval($_GET['id']);

    if ($type === 'positions') {
        // Check if position is in use
        $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM employees WHERE position_id = ? AND company_id = ?");
        $stmt->bind_param('ii', $id, $company_id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if ((int)$row['cnt'] > 0) {
            json_response(['error' => 'ไม่สามารถลบได้ ยังมีพนักงานใช้ตำแหน่งนี้อยู่'], 400);
        }
        $stmt2 = $conn->prepare("DELETE FROM positions WHERE id = ? AND company_id = ?");
        $stmt2->bind_param('ii', $id, $company_id);
        $stmt2->execute();
        json_response(['message' => 'Position deleted']);
    }

    // Default: delete department
    $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM employees WHERE department_id = ? AND company_id = ?");
    $stmt->bind_param('ii', $id, $company_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if ((int)$row['cnt'] > 0) {
        json_response(['error' => 'ไม่สามารถลบได้ ยังมีพนักงานอยู่ในแผนกนี้'], 400);
    }
    $stmt2 = $conn->prepare("DELETE FROM departments WHERE id = ? AND company_id = ?");
    $stmt2->bind_param('ii', $id, $company_id);
    $stmt2->execute();
    json_response(['message' => 'Department deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
