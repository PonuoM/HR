<?php
/**
 * Push Subscriptions API
 * POST   /api/push_subscriptions.php - Subscribe (save push subscription)
 * DELETE /api/push_subscriptions.php?employee_id=X - Unsubscribe
 */
require_once __DIR__ . '/config.php';

$method = get_method();

// Auto-create table if not exists
$conn->query("CREATE TABLE IF NOT EXISTS `push_subscriptions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` VARCHAR(20) NOT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_employee` (`employee_id`)
) ENGINE=InnoDB");

// POST — Save subscription
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $employee_id = $body['employee_id'] ?? '';
    $endpoint = $body['endpoint'] ?? '';
    $p256dh = $body['keys']['p256dh'] ?? '';
    $auth = $body['keys']['auth'] ?? '';

    if (!$employee_id || !$endpoint || !$p256dh || !$auth) {
        json_response(['error' => 'Missing fields'], 400);
    }

    // Remove existing subscription with same endpoint (update)
    $delStmt = $conn->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
    $delStmt->bind_param('s', $endpoint);
    $delStmt->execute();

    // Insert new
    $stmt = $conn->prepare("INSERT INTO push_subscriptions (employee_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)");
    $stmt->bind_param('ssss', $employee_id, $endpoint, $p256dh, $auth);
    $stmt->execute();

    json_response(['message' => 'Subscribed', 'id' => $conn->insert_id], 201);
}

// DELETE — Remove subscription
if ($method === 'DELETE') {
    $employee_id = $_GET['employee_id'] ?? '';
    $endpoint = $_GET['endpoint'] ?? '';

    if ($endpoint) {
        $stmt = $conn->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
        $stmt->bind_param('s', $endpoint);
        $stmt->execute();
    } elseif ($employee_id) {
        $stmt = $conn->prepare("DELETE FROM push_subscriptions WHERE employee_id = ?");
        $stmt->bind_param('s', $employee_id);
        $stmt->execute();
    }

    json_response(['message' => 'Unsubscribed', 'affected' => $conn->affected_rows]);
}

json_response(['error' => 'Method not allowed'], 405);
