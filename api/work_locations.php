<?php
/**
 * Work Locations API (Multi-Company)
 * GET    /api/work_locations.php       - List active work locations
 * POST   /api/work_locations.php       - Create new location
 * PUT    /api/work_locations.php?id=X  - Update location
 * DELETE /api/work_locations.php?id=X  - Delete location
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT * FROM work_locations WHERE company_id = ? ORDER BY name");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $locations = [];
    while ($row = $result->fetch_assoc()) {
        $row['latitude'] = (float)$row['latitude'];
        $row['longitude'] = (float)$row['longitude'];
        $row['radius_meters'] = (int)$row['radius_meters'];
        $row['is_active'] = (bool)(int)$row['is_active'];
        $locations[] = $row;
    }
    json_response($locations);
}

if ($method === 'POST') {
    $body = get_json_body();
    $name = $conn->real_escape_string($body['name'] ?? '');
    $lat = (float)($body['latitude'] ?? 0);
    $lng = (float)($body['longitude'] ?? 0);
    $radius = (int)($body['radius_meters'] ?? 200);
    $is_active = isset($body['is_active']) ? (int)$body['is_active'] : 1;

    if (!$name || !$lat || !$lng) {
        json_response(['error' => 'name, latitude, longitude are required'], 400);
    }

    $stmt = $conn->prepare("INSERT INTO work_locations (company_id, name, latitude, longitude, radius_meters, is_active) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('isddii', $company_id, $name, $lat, $lng, $radius, $is_active);
    $stmt->execute();
    json_response(['message' => 'Created', 'id' => $conn->insert_id]);
}

if ($method === 'PUT' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $body = get_json_body();
    $name = $conn->real_escape_string($body['name'] ?? '');
    $lat = (float)($body['latitude'] ?? 0);
    $lng = (float)($body['longitude'] ?? 0);
    $radius = (int)($body['radius_meters'] ?? 200);
    $is_active = isset($body['is_active']) ? (int)$body['is_active'] : 1;

    $stmt = $conn->prepare("UPDATE work_locations SET name = ?, latitude = ?, longitude = ?, radius_meters = ?, is_active = ? WHERE id = ? AND company_id = ?");
    $stmt->bind_param('sddiii', $name, $lat, $lng, $radius, $is_active, $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Updated']);
}

if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $stmt = $conn->prepare("DELETE FROM work_locations WHERE id = ? AND company_id = ?");
    $stmt->bind_param('ii', $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
