<?php
/**
 * Departments & Positions API
 * GET /api/departments.php              - List departments
 * GET /api/departments.php?type=positions - List positions
 * PUT /api/departments.php?id=X         - Update department
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    $type = $_GET['type'] ?? 'departments';

    if ($type === 'positions') {
        $result = $conn->query("SELECT * FROM positions ORDER BY id");
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = $row;
        }
        json_response($items);
    }

    // Default: departments
    $result = $conn->query("SELECT * FROM departments ORDER BY id");
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $items[] = $row;
    }
    json_response($items);
}

if ($method === 'PUT' && isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $body = json_decode(file_get_contents('php://input'), true);

    $name = $conn->real_escape_string($body['name'] ?? '');
    $work_start = $conn->real_escape_string($body['work_start_time'] ?? '09:00:00');
    $work_end = $conn->real_escape_string($body['work_end_time'] ?? '17:00:00');
    $is_admin_system = isset($body['is_admin_system']) ? intval($body['is_admin_system']) : null;

    // Auto-calculate work_hours_per_day from start/end times
    $start_parts = explode(':', $work_start);
    $end_parts = explode(':', $work_end);
    $start_minutes = intval($start_parts[0]) * 60 + intval($start_parts[1] ?? 0);
    $end_minutes = intval($end_parts[0]) * 60 + intval($end_parts[1] ?? 0);
    $work_hours = round(($end_minutes - $start_minutes) / 60, 2);
    if ($work_hours <= 0) $work_hours = 8;

    if ($is_admin_system !== null) {
        $stmt = $conn->prepare("UPDATE departments SET name = ?, work_start_time = ?, work_end_time = ?, work_hours_per_day = ?, is_admin_system = ? WHERE id = ?");
        $stmt->bind_param('sssdii', $name, $work_start, $work_end, $work_hours, $is_admin_system, $id);
    } else {
        $stmt = $conn->prepare("UPDATE departments SET name = ?, work_start_time = ?, work_end_time = ?, work_hours_per_day = ? WHERE id = ?");
        $stmt->bind_param('sssdi', $name, $work_start, $work_end, $work_hours, $id);
    }
    $stmt->execute();

    if ($stmt->affected_rows >= 0) {
        json_response(['message' => 'Department updated', 'id' => $id, 'work_hours_per_day' => $work_hours]);
    } else {
        json_response(['error' => 'Department not found'], 404);
    }
}

// PUT positions
if ($method === 'PUT' && isset($_GET['type']) && $_GET['type'] === 'positions' && isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $body = json_decode(file_get_contents('php://input'), true);

    $name = $conn->real_escape_string($body['name'] ?? '');
    $can_have_subordinates = isset($body['can_have_subordinates']) ? intval($body['can_have_subordinates']) : 0;

    $stmt = $conn->prepare("UPDATE positions SET name = ?, can_have_subordinates = ? WHERE id = ?");
    $stmt->bind_param('sii', $name, $can_have_subordinates, $id);
    $stmt->execute();

    if ($stmt->affected_rows >= 0) {
        json_response(['message' => 'Position updated', 'id' => $id]);
    } else {
        json_response(['error' => 'Position not found'], 404);
    }
}

json_response(['error' => 'Method not allowed'], 405);

