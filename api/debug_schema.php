<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
$result = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'allowance_requests' ORDER BY ORDINAL_POSITION");
$cols = [];
while ($row = $result->fetch_assoc()) $cols[] = $row['COLUMN_NAME'];
echo json_encode(['columns' => $cols, 'count' => count($cols)], JSON_UNESCAPED_UNICODE);
