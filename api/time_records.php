<?php
/**
 * Time Records API — retroactive / off-site attendance entries
 * GET    /api/time_records.php?employee_id=X  - List records for employee
 * POST   /api/time_records.php                - Create new time record request
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    $employee_id = $conn->real_escape_string($_GET['employee_id'] ?? 'EMP001');

    $sql = "SELECT tr.*, wl.name as work_location_name
            FROM time_records tr
            LEFT JOIN work_locations wl ON tr.location_id = wl.id
            WHERE tr.employee_id = '$employee_id'
            ORDER BY tr.record_date DESC";
    $result = $conn->query($sql);
    $records = [];
    while ($row = $result->fetch_assoc()) {
        $records[] = $row;
    }
    json_response($records);
}

if ($method === 'POST') {
    $body = get_json_body();
    $employee_id = $conn->real_escape_string($body['employee_id'] ?? '');
    $record_date = $conn->real_escape_string($body['record_date'] ?? '');
    $clock_in_time = $conn->real_escape_string($body['clock_in_time'] ?? '');
    $clock_out_time = !empty($body['clock_out_time']) ? "'" . $conn->real_escape_string($body['clock_out_time']) . "'" : 'NULL';
    $location_id = isset($body['location_id']) ? (int)$body['location_id'] : 'NULL';
    $location_name = $conn->real_escape_string($body['location_name'] ?? '');
    $reason = $conn->real_escape_string($body['reason'] ?? '');

    if (!$employee_id || !$record_date || !$clock_in_time) {
        json_response(['error' => 'employee_id, record_date, and clock_in_time are required'], 400);
    }

    $sql = "INSERT INTO time_records (employee_id, record_date, clock_in_time, clock_out_time, location_id, location_name, reason)
            VALUES ('$employee_id', '$record_date', '$clock_in_time', $clock_out_time, $location_id, '$location_name', '$reason')";
    $conn->query($sql);

    json_response(['message' => 'Time record created', 'id' => $conn->insert_id]);
}

json_response(['error' => 'Method not allowed'], 405);
