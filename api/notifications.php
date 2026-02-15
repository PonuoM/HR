<?php
/**
 * Notifications API
 * GET    /api/notifications.php?employee_id=X          - List notifications
 * PUT    /api/notifications.php?id=X                   - Mark single as read
 * PUT    /api/notifications.php?mark_all=1&employee_id=X - Mark all as read
 * DELETE /api/notifications.php?id=X                   - Delete notification
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    $employee_id = $conn->real_escape_string($_GET['employee_id'] ?? 'EMP001');
    $sql = "SELECT * FROM notifications WHERE employee_id = '$employee_id' ORDER BY created_at DESC";
    $result = $conn->query($sql);
    $notifications = [];
    while ($row = $result->fetch_assoc()) {
        $row['is_read'] = (bool)$row['is_read'];
        $notifications[] = $row;
    }
    json_response($notifications);
}

if ($method === 'PUT') {
    // Mark all as read for an employee
    if (isset($_GET['mark_all']) && isset($_GET['employee_id'])) {
        $employee_id = $conn->real_escape_string($_GET['employee_id']);
        $conn->query("UPDATE notifications SET is_read = 1 WHERE employee_id = '$employee_id' AND is_read = 0");
        json_response(['message' => 'All marked as read', 'affected' => $conn->affected_rows]);
    }

    // Mark single as read
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        $conn->query("UPDATE notifications SET is_read = 1 WHERE id = $id");
        json_response(['message' => 'Marked as read']);
    }
}

if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $conn->query("DELETE FROM notifications WHERE id = $id");
    json_response(['message' => 'Deleted']);
}

json_response(['error' => 'Method not allowed'], 405);

