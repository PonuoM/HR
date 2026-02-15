<?php
/**
 * Push Notification Test & Debug Endpoint
 * GET /api/test_push.php — Show environment info
 * GET /api/test_push.php?employee_id=X — Test push to specific employee
 */
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$diagnostics = [];

// 1. Check PHP version
$diagnostics['php_version'] = PHP_VERSION;
$diagnostics['php_major'] = PHP_MAJOR_VERSION;
$diagnostics['php_minor'] = PHP_MINOR_VERSION;

// 2. Check required extensions
$diagnostics['extensions'] = [
    'openssl' => extension_loaded('openssl'),
    'curl' => extension_loaded('curl'),
    'json' => extension_loaded('json'),
];

// 3. Check OpenSSL capabilities
$diagnostics['openssl_version'] = defined('OPENSSL_VERSION_TEXT') ? OPENSSL_VERSION_TEXT : 'N/A';
$diagnostics['openssl_functions'] = [
    'openssl_pkey_new' => function_exists('openssl_pkey_new'),
    'openssl_pkey_derive' => function_exists('openssl_pkey_derive'),
    'openssl_sign' => function_exists('openssl_sign'),
    'openssl_encrypt' => function_exists('openssl_encrypt'),
    'openssl_pkey_get_private' => function_exists('openssl_pkey_get_private'),
];

// 4. Test EC key generation (P-256)
$diagnostics['ec_key_test'] = 'not_tested';
try {
    $testKey = openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ]);
    if ($testKey) {
        $details = openssl_pkey_get_details($testKey);
        $diagnostics['ec_key_test'] = 'success';
        $diagnostics['ec_key_curve'] = $details['ec']['curve_name'] ?? 'unknown';
    } else {
        $diagnostics['ec_key_test'] = 'failed: ' . openssl_error_string();
    }
} catch (Throwable $e) {
    $diagnostics['ec_key_test'] = 'exception: ' . $e->getMessage();
}

// 5. Check push subscriptions table
$diagnostics['push_table_exists'] = false;
$result = $conn->query("SHOW TABLES LIKE 'push_subscriptions'");
if ($result && $result->num_rows > 0) {
    $diagnostics['push_table_exists'] = true;
    $countResult = $conn->query("SELECT COUNT(*) as cnt FROM push_subscriptions");
    $diagnostics['total_subscriptions'] = $countResult->fetch_assoc()['cnt'];
}

// 6. If employee_id provided, test sending
if (isset($_GET['employee_id'])) {
    $employee_id = $_GET['employee_id'];
    
    // Check subscriptions for this employee
    $stmt = $conn->prepare("SELECT id, endpoint, LEFT(p256dh, 20) as p256dh_preview, LEFT(auth, 10) as auth_preview, created_at FROM push_subscriptions WHERE employee_id = ?");
    $stmt->bind_param('s', $employee_id);
    $stmt->execute();
    $subs = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $diagnostics['employee_subscriptions'] = $subs;
    $diagnostics['subscription_count'] = count($subs);
    
    // Try sending if subscriptions exist
    if (count($subs) > 0) {
        try {
            require_once __DIR__ . '/send_push.php';
            $result = send_push_to_employee($conn, $employee_id, 'ทดสอบ Push', 'นี่คือ push notification ทดสอบจาก HR Connect');
            $diagnostics['send_result'] = $result;
        } catch (Throwable $e) {
            $diagnostics['send_error'] = $e->getMessage();
            $diagnostics['send_error_trace'] = $e->getTraceAsString();
        }
    } else {
        $diagnostics['send_result'] = 'no_subscriptions';
    }
}

// 7. Check send_push.php loadability
$diagnostics['send_push_loadable'] = false;
try {
    require_once __DIR__ . '/send_push.php';
    $diagnostics['send_push_loadable'] = true;
    $diagnostics['send_push_function_exists'] = function_exists('send_push_to_employee');
} catch (Throwable $e) {
    $diagnostics['send_push_error'] = $e->getMessage();
}

echo json_encode($diagnostics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
