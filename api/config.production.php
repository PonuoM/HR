<?php

/**
 * HR Mobile Connect - API Configuration (PRODUCTION)
 * Database connection and utility functions
 */

// --- Timezone (Thailand UTC+7) ---
date_default_timezone_set('Asia/Bangkok');

// --- CORS ---
$allowed_origins = ['https://hr.prima49.com', 'http://hr.prima49.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://hr.prima49.com');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Company-Id, X-Employee-Id, X-Session-Token');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- Database credentials (Production) ---
// Loaded from (in order): env vars → api/.db-secrets.php (gitignored).
// On Apache: use SetEnv HR_DB_PASS xxx in vhost/.htaccess.
// See api/.db-secrets.example.php for template.
$DB_HOST = getenv('HR_DB_HOST') ?: 'localhost';
$DB_USER = getenv('HR_DB_USER') ?: '';
$DB_PASS = getenv('HR_DB_PASS');
$DB_NAME = getenv('HR_DB_NAME') ?: '';

if ($DB_USER === '' || $DB_PASS === false || $DB_NAME === '') {
    $secretsFile = __DIR__ . '/.db-secrets.php';
    if (file_exists($secretsFile)) {
        $local = require $secretsFile;
        if ($DB_HOST === 'localhost' && !empty($local['host'])) $DB_HOST = $local['host'];
        if ($DB_USER === '') $DB_USER = $local['user'] ?? '';
        if ($DB_PASS === false || $DB_PASS === '') $DB_PASS = $local['pass'] ?? '';
        if ($DB_NAME === '') $DB_NAME = $local['name'] ?? '';
    }
}

if ($DB_USER === '' || $DB_PASS === '' || $DB_NAME === '') {
    error_log('DB credentials missing — set HR_DB_* env vars or create api/.db-secrets.php');
    http_response_code(500);
    echo json_encode(['error' => 'ระบบขัดข้อง กรุณาติดต่อผู้ดูแลระบบ']);
    exit;
}

$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
$conn->set_charset('utf8mb4');
$conn->query("SET time_zone = '+07:00'");
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

if ($conn->connect_error) {
    error_log('DB connection failed: ' . $conn->connect_error);
    http_response_code(500);
    echo json_encode(['error' => 'ระบบขัดข้อง กรุณาลองใหม่ภายหลัง']);
    exit;
}

// --- Utilities ---
function json_response($data, $status = 200)
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function get_json_body()
{
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function get_method()
{
    return $_SERVER['REQUEST_METHOD'];
}

/**
 * Get the company_id from the X-Company-Id header.
 * Falls back to 1 (default company) if not set.
 */
function get_company_id()
{
    $headers = getallheaders();
    $companyId = $headers['X-Company-Id'] ?? $headers['x-company-id'] ?? null;
    if ($companyId) return (int)$companyId;
    if (isset($_GET['company_id'])) return (int)$_GET['company_id'];
    return 1;
}

/**
 * Get the employee_id from the X-Employee-Id header.
 */
function get_employee_id()
{
    $headers = getallheaders();
    return $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? '';
}

/**
 * Require that the caller is an admin (is_admin = 1).
 * Returns a 403 error if not an admin.
 */
function require_admin($conn, $required_permission = null)
{
    $empId = get_employee_id();
    if (!$empId) json_response(['error' => 'Unauthorized: missing employee ID'], 403);
    
    $stmt = $conn->prepare("SELECT e.is_admin, e.is_superadmin, p.is_admin AS position_is_admin, p.permissions 
                            FROM employees e 
                            LEFT JOIN positions p ON e.position_id = p.id 
                            WHERE e.id = ? AND e.is_active = 1");
    $stmt->bind_param('s', $empId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    
    if (!$row) {
        json_response(['error' => 'Forbidden: admin access required'], 403);
    }

    $is_global_admin = (int)($row['is_superadmin'] ?? 0);
    
    if ($is_global_admin) {
        return $empId;
    }

    if ($required_permission) {
        $permissions = $row['permissions'] ? json_decode($row['permissions'], true) : [];
        if (is_array($permissions) && in_array($required_permission, $permissions)) {
            return $empId;
        }
    } else {
        // If no specific permission required, just being an admin is enough
        $is_admin = ((int)($row['is_admin'] ?? 0)) | ((int)($row['position_is_admin'] ?? 0));
        if ($is_admin) {
            return $empId;
        }
    }

    json_response(['error' => 'Forbidden: admin access required'], 403);
}

/**
 * Check if the user is an admin or has the required permission without throwing an error
 * Returns boolean
 */
function is_admin_user($conn, $empId, $required_permission = null) {
    if (!$empId) return false;
    $stmt = $conn->prepare("SELECT e.is_admin, e.is_superadmin, p.is_admin AS position_is_admin, p.permissions 
                            FROM employees e 
                            LEFT JOIN positions p ON e.position_id = p.id 
                            WHERE e.id = ? AND e.is_active = 1");
    $stmt->bind_param('s', $empId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) return false;

    $is_global_admin = (int)($row['is_superadmin'] ?? 0);
    if ($is_global_admin) return true;

    if ($required_permission) {
        $permissions = $row['permissions'] ? json_decode($row['permissions'], true) : [];
        return is_array($permissions) && in_array($required_permission, $permissions);
    } else {
        $is_admin = ((int)($row['is_admin'] ?? 0)) | ((int)($row['position_is_admin'] ?? 0));
        return (bool)$is_admin;
    }
}
