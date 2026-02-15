<?php
/**
 * Push Notification Test & Debug Endpoint
 * GET /api/test_push.php — Auto-test push with first available subscription
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/send_push.php';

header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 0);

$diagnostics = [];
$diagnostics['php_version'] = PHP_VERSION;
$diagnostics['openssl_version'] = OPENSSL_VERSION_TEXT ?? 'N/A';

// Find first subscription
$subResult = $conn->query("SELECT * FROM push_subscriptions ORDER BY created_at DESC LIMIT 1");
$sub = $subResult ? $subResult->fetch_assoc() : null;

if (!$sub) {
    $diagnostics['error'] = 'No push subscriptions found. Open the app first to subscribe.';
    echo json_encode($diagnostics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

$diagnostics['subscription'] = [
    'employee_id' => $sub['employee_id'],
    'endpoint_preview' => substr($sub['endpoint'], 0, 80) . '...',
    'has_p256dh' => !empty($sub['p256dh']),
    'has_auth' => !empty($sub['auth']),
];

// Step-by-step test
$diagnostics['steps'] = [];

// Step 1: Load private key
$privateKeyRaw = base64url_decode(VAPID_PRIVATE_KEY);
$diagnostics['steps'][] = ['step' => '1. Decode VAPID private key', 'length' => strlen($privateKeyRaw), 'ok' => strlen($privateKeyRaw) === 32];

// Step 2: Build PEM
$pem = "-----BEGIN EC PRIVATE KEY-----\n" .
    chunk_split(base64_encode(
        "\x30\x41\x02\x01\x00\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x04\x27\x30\x25\x02\x01\x01\x04\x20" . $privateKeyRaw
    ), 64, "\n") .
    "-----END EC PRIVATE KEY-----\n";

$key = openssl_pkey_get_private($pem);
$openssl_err = openssl_error_string();
$diagnostics['steps'][] = ['step' => '2. Load VAPID private key as PEM', 'ok' => $key !== false, 'openssl_error' => $openssl_err ?: null];

if (!$key) {
    // Try alternative PEM format (SEC1/traditional EC)
    $pem2 = "-----BEGIN EC PRIVATE KEY-----\n" .
        chunk_split(base64_encode(
            "\x30\x25\x02\x01\x01\x04\x20" . $privateKeyRaw . "\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07"
        ), 64, "\n") .
        "-----END EC PRIVATE KEY-----\n";
    $key = openssl_pkey_get_private($pem2);
    $openssl_err2 = openssl_error_string();
    $diagnostics['steps'][] = ['step' => '2b. Try alternative SEC1 PEM format', 'ok' => $key !== false, 'openssl_error' => $openssl_err2 ?: null];
}

// Step 3: Sign JWT
if ($key) {
    $urlParts = parse_url($sub['endpoint']);
    $audience = $urlParts['scheme'] . '://' . $urlParts['host'];
    
    $header = base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $jwtPayload = base64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 86400,
        'sub' => VAPID_SUBJECT,
    ]));
    $signingInput = "$header.$jwtPayload";
    
    $signature = '';
    $signResult = openssl_sign($signingInput, $signature, $key, OPENSSL_ALGO_SHA256);
    $openssl_err3 = openssl_error_string();
    $diagnostics['steps'][] = ['step' => '3. Sign VAPID JWT', 'ok' => $signResult, 'sig_length' => strlen($signature), 'openssl_error' => $openssl_err3 ?: null];
}

// Step 4: Generate server EC key 
$serverKey = openssl_pkey_new([
    'curve_name' => 'prime256v1',
    'private_key_type' => OPENSSL_KEYTYPE_EC,
]);
$diagnostics['steps'][] = ['step' => '4. Generate server EC key', 'ok' => $serverKey !== false];

// Step 5: Test ECDH key derivation
if ($serverKey) {
    $clientPublicKeyRaw = base64url_decode($sub['p256dh']);
    $diagnostics['steps'][] = ['step' => '5a. Decode client public key', 'length' => strlen($clientPublicKeyRaw), 'first_byte' => ord($clientPublicKeyRaw[0])];
    
    // Build client public key PEM
    $der = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00" . $clientPublicKeyRaw;
    $clientPem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    
    $clientKey = openssl_pkey_get_public($clientPem);
    $openssl_err4 = openssl_error_string();
    $diagnostics['steps'][] = ['step' => '5b. Load client public key', 'ok' => $clientKey !== false, 'openssl_error' => $openssl_err4 ?: null];
    
    if ($clientKey) {
        $shared = @openssl_pkey_derive($serverKey, $clientKey, 256);
        $openssl_err5 = openssl_error_string();
        $diagnostics['steps'][] = ['step' => '5c. ECDH key derivation', 'ok' => $shared !== false, 'shared_length' => $shared ? strlen($shared) : 0, 'openssl_error' => $openssl_err5 ?: null];
    }
}

// Step 6: Full send test
$diagnostics['steps'][] = ['step' => '6. Full push test - sending...'];
try {
    $result = send_push_to_employee($conn, $sub['employee_id'], '🔔 ทดสอบ Push', 'Push notification ทำงานแล้ว! - HR Connect');
    $diagnostics['send_result'] = $result;
    $diagnostics['steps'][] = ['step' => '6. Result', 'ok' => ($result['sent'] ?? 0) > 0, 'result' => $result];
} catch (Throwable $e) {
    $diagnostics['steps'][] = ['step' => '6. FAILED', 'error' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()];
}

echo json_encode($diagnostics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
