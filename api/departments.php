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
        // Auto-migration for permissions column
        $colCheck = $conn->query("SHOW COLUMNS FROM positions LIKE 'permissions'");
        if ($colCheck && $colCheck->num_rows === 0) {
            $conn->query("ALTER TABLE positions ADD COLUMN `permissions` TEXT NULL");
        }

        // Auto-migration for is_admin column
        $colCheckAdmin = $conn->query("SHOW COLUMNS FROM positions LIKE 'is_admin'");
        if ($colCheckAdmin && $colCheckAdmin->num_rows === 0) {
            $conn->query("ALTER TABLE positions ADD COLUMN `is_admin` TINYINT(1) DEFAULT 0");
        }

        $stmt = $conn->prepare("SELECT * FROM positions WHERE company_id = ? ORDER BY id");
        $stmt->bind_param('i', $company_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $row['can_have_subordinates'] = (int)($row['can_have_subordinates'] ?? 0);
            $row['is_admin'] = (int)($row['is_admin'] ?? 0);
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
    require_admin($conn);
    $body = get_json_body();

    if ($type === 'positions') {
        $name = $conn->real_escape_string($body['name'] ?? '');
        $can_sub = isset($body['can_have_subordinates']) ? intval($body['can_have_subordinates']) : 0;
        $is_admin = isset($body['is_admin']) ? intval($body['is_admin']) : 0;
        $permissions = isset($body['permissions']) && is_array($body['permissions']) ? json_encode($body['permissions']) : null;

        if (!$name) json_response(['error' => 'Name is required'], 400);

        $stmt = $conn->prepare("INSERT INTO positions (company_id, name, can_have_subordinates, is_admin, permissions) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param('isiis', $company_id, $name, $can_sub, $is_admin, $permissions);
        $stmt->execute();
        json_response(['id' => $conn->insert_id, 'message' => 'Position created'], 201);
    }

    // Default: create department
    $name = $conn->real_escape_string($body['name'] ?? '');
    $work_start = $body['work_start_time'] ?? '09:00:00';
    $work_end = $body['work_end_time'] ?? '17:00:00';
    $is_admin = isset($body['is_admin_system']) ? intval($body['is_admin_system']) : 0;
    $schedule_json = isset($body['schedule_json']) ? (is_string($body['schedule_json']) ? $body['schedule_json'] : json_encode($body['schedule_json'], JSON_UNESCAPED_UNICODE)) : null;
    $late_grace = isset($body['late_grace_minutes']) && $body['late_grace_minutes'] !== '' ? intval($body['late_grace_minutes']) : null;

    if (!$name) json_response(['error' => 'Name is required'], 400);

    // Auto-calculate work hours: prefer 8h-day - 1h lunch convention to match runtime calc
    $sp = explode(':', $work_start);
    $ep = explode(':', $work_end);
    $rawMin = (intval($ep[0]) * 60 + intval($ep[1] ?? 0)) - (intval($sp[0]) * 60 + intval($sp[1] ?? 0));
    $work_hours = round(max(0, $rawMin - 60) / 60, 2); // subtract 1h lunch
    if ($work_hours <= 0) $work_hours = 8;

    $stmt = $conn->prepare("INSERT INTO departments (company_id, name, work_start_time, work_end_time, work_hours_per_day, is_admin_system, schedule_json, late_grace_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('isssdisi', $company_id, $name, $work_start, $work_end, $work_hours, $is_admin, $schedule_json, $late_grace);
    $stmt->execute();
    json_response(['id' => $conn->insert_id, 'message' => 'Department created'], 201);
}

// ======================== PUT (Update) ========================
if ($method === 'PUT' && isset($_GET['id'])) {
    require_admin($conn);
    $id = intval($_GET['id']);
    $body = json_decode(file_get_contents('php://input'), true);

    if ($type === 'positions') {
        $name = $conn->real_escape_string($body['name'] ?? '');
        $can_sub = isset($body['can_have_subordinates']) ? intval($body['can_have_subordinates']) : 0;
        $is_admin = isset($body['is_admin']) ? intval($body['is_admin']) : 0;
        $permissions = isset($body['permissions']) && is_array($body['permissions']) ? json_encode($body['permissions']) : null;

        $stmt = $conn->prepare("UPDATE positions SET name = ?, can_have_subordinates = ?, is_admin = ?, permissions = ? WHERE id = ? AND company_id = ?");
        $stmt->bind_param('siisii', $name, $can_sub, $is_admin, $permissions, $id, $company_id);
        $stmt->execute();
        json_response(['message' => 'Position updated', 'id' => $id]);
    }

    // Default: update department
    $name = $conn->real_escape_string($body['name'] ?? '');
    $work_start = $conn->real_escape_string($body['work_start_time'] ?? '09:00:00');
    $work_end = $conn->real_escape_string($body['work_end_time'] ?? '17:00:00');
    $is_admin = isset($body['is_admin_system']) ? intval($body['is_admin_system']) : 0;
    $schedule_json = isset($body['schedule_json']) ? (is_string($body['schedule_json']) ? $body['schedule_json'] : json_encode($body['schedule_json'], JSON_UNESCAPED_UNICODE)) : null;
    $late_grace = isset($body['late_grace_minutes']) && $body['late_grace_minutes'] !== '' ? intval($body['late_grace_minutes']) : null;

    $sp = explode(':', $work_start);
    $ep = explode(':', $work_end);
    $rawMin = (intval($ep[0]) * 60 + intval($ep[1] ?? 0)) - (intval($sp[0]) * 60 + intval($sp[1] ?? 0));
    $work_hours = round(max(0, $rawMin - 60) / 60, 2); // subtract 1h lunch
    if ($work_hours <= 0) $work_hours = 8;

    $stmt = $conn->prepare("UPDATE departments SET name = ?, work_start_time = ?, work_end_time = ?, work_hours_per_day = ?, is_admin_system = ?, schedule_json = ?, late_grace_minutes = ? WHERE id = ? AND company_id = ?");
    $stmt->bind_param('sssdisiii', $name, $work_start, $work_end, $work_hours, $is_admin, $schedule_json, $late_grace, $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Department updated', 'id' => $id, 'work_hours_per_day' => $work_hours]);
}

// ======================== DELETE ========================
if ($method === 'DELETE' && isset($_GET['id'])) {
    require_admin($conn);
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
