<?php
/**
 * FAQ API
 * GET /api/faq.php  - List all FAQ items
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    $sql = "SELECT id, question, answer FROM faq WHERE is_active = 1 ORDER BY sort_order";
    $result = $conn->query($sql);
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $items[] = $row;
    }
    json_response($items);
}

json_response(['error' => 'Method not allowed'], 405);
