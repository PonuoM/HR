<?php
/**
 * FAQ API (Multi-Company)
 * GET /api/faq.php  - List all FAQ items
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, question, answer FROM faq WHERE is_active = 1 AND company_id = ? ORDER BY sort_order");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $items[] = $row;
    }
    json_response($items);
}

json_response(['error' => 'Method not allowed'], 405);
