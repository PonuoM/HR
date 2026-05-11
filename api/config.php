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
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Company-Id, X-Employee-Id, X-Session-Token');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- Database credentials ---
// Loaded from (in order): env vars → api/.db-secrets.php (gitignored)
// See api/.db-secrets.example.php for template.
$DB_HOST = getenv('HR_DB_HOST') ?: '';
$DB_USER = getenv('HR_DB_USER') ?: '';
$DB_PASS = getenv('HR_DB_PASS');
$DB_NAME = getenv('HR_DB_NAME') ?: '';

if ($DB_HOST === '' || $DB_USER === '' || $DB_PASS === false || $DB_NAME === '') {
    $secretsFile = __DIR__ . '/.db-secrets.php';
    if (file_exists($secretsFile)) {
        $local = require $secretsFile;
        if ($DB_HOST === '') $DB_HOST = $local['host'] ?? '';
        if ($DB_USER === '') $DB_USER = $local['user'] ?? '';
        if ($DB_PASS === false || $DB_PASS === '') $DB_PASS = $local['pass'] ?? '';
        if ($DB_NAME === '') $DB_NAME = $local['name'] ?? '';
    }
}

if ($DB_HOST === '' || $DB_USER === '' || $DB_PASS === '' || $DB_NAME === '') {
    http_response_code(500);
    echo json_encode([
        'error' => 'Database credentials not configured.',
        'hint' => 'Set env vars HR_DB_HOST/USER/PASS/NAME or create api/.db-secrets.php (see api/.db-secrets.example.php).'
    ]);
    exit;
}

$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
$conn->set_charset('utf8mb4');
$conn->query("SET time_zone = '+07:00'");
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

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

/**
 * Get the company_id from the X-Company-Id header.
 * Falls back to 1 (default company) if not set.
 */
function get_company_id() {
    $headers = getallheaders();
    $companyId = $headers['X-Company-Id'] ?? $headers['x-company-id'] ?? null;
    if ($companyId) return (int)$companyId;
    // Fallback: check query parameter
    if (isset($_GET['company_id'])) return (int)$_GET['company_id'];
    return 1; // Default company
}

/**
 * Get the employee_id from the X-Employee-Id header.
 */
function get_employee_id() {
    $headers = getallheaders();
    return $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? '';
}

/**
 * Require that the caller is an admin (is_admin = 1).
 * Returns a 403 error if not an admin.
 */
function require_admin($conn) {
    $empId = get_employee_id();
    if (!$empId) json_response(['error' => 'Unauthorized: missing employee ID'], 403);
    $stmt = $conn->prepare("SELECT is_admin FROM employees WHERE id = ? AND is_active = 1");
    $stmt->bind_param('s', $empId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row || !$row['is_admin']) {
        json_response(['error' => 'Forbidden: admin access required'], 403);
    }
    return $empId;
}
