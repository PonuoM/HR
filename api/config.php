<?php
/**
 * HR Mobile Connect - API Configuration
 * Database connection and utility functions
 */

// --- Timezone (Thailand UTC+7) ---
date_default_timezone_set('Asia/Bangkok');

// --- CORS ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- Database ---
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '12345678';
$DB_NAME = 'hr_mobile_connect';

$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
$conn->set_charset('utf8mb4');
$conn->query("SET time_zone = '+07:00'");

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
    exit;
}

// --- Utilities ---
function json_response($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function get_json_body() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function get_method() {
    return $_SERVER['REQUEST_METHOD'];
}
