<?php
/**
 * Send Web Push Notification helper
 * Uses VAPID keys + curl to send push notifications via Web Push Protocol
 * 
 * Usage: require_once 'send_push.php'; send_push_to_employee($conn, 'EMP001', 'Title', 'Body');
 */

// VAPID keys
define('VAPID_PUBLIC_KEY', 'BCwSjv55yp7HKvPYV52l2yYpxdW-rrDWc3aCiWI5UIaBEY_qQuufaW6ye8nuM_ZeHSAQEqeh22-HHvy6T5meU7M');
define('VAPID_PRIVATE_KEY', 'ZsWKT0fQA0rNVL7R5Z2Vb_xhAH5A8sRaI-h55DhGMuA');
define('VAPID_SUBJECT', 'mailto:hr@prima49.com');

/**
 * Send push notification to all subscriptions of an employee
 */
function send_push_to_employee($conn, $employee_id, $title, $body, $url = '/') {
    $stmt = $conn->prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE employee_id = ?");
    $stmt->bind_param('s', $employee_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $payload = json_encode([
        'title' => $title,
        'body' => $body,
        'icon' => '/icons/icon-512.svg',
        'url' => $url,
    ]);

    $sent = 0;
    $failed = 0;

    while ($sub = $result->fetch_assoc()) {
        $success = send_web_push($sub['endpoint'], $sub['p256dh'], $sub['auth'], $payload);
        if ($success) {
            $sent++;
        } else {
            $failed++;
            // Remove expired/invalid subscription
            $delStmt = $conn->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
            $delStmt->bind_param('s', $sub['endpoint']);
            $delStmt->execute();
        }
    }

    return ['sent' => $sent, 'failed' => $failed];
}

/**
 * Send a single push notification using Web Push Protocol
 * Implements JWT (VAPID) signing with ES256
 */
function send_web_push($endpoint, $p256dh, $auth, $payload) {
    // Parse the endpoint URL
    $urlParts = parse_url($endpoint);
    $audience = $urlParts['scheme'] . '://' . $urlParts['host'];

    // Create JWT for VAPID
    $header = base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $jwtPayload = base64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 86400,
        'sub' => VAPID_SUBJECT,
    ]));

    $signingInput = "$header.$jwtPayload";

    // Decode private key
    $privateKeyRaw = base64url_decode(VAPID_PRIVATE_KEY);

    // Build PEM from raw private key + public key
    $publicKeyRaw = base64url_decode(VAPID_PUBLIC_KEY);

    // Create EC key from raw bytes
    $keyData = "\x30\x77\x02\x01\x01\x04\x20" . $privateKeyRaw .
        "\xa0\x0a\x30\x08\x06\x06\x2b\x81\x04\x00\x22" . // This is wrong for P-256, using openssl instead
        "\xa1\x44\x03\x42\x00\x04" . $publicKeyRaw;

    // Use openssl directly with proper DER encoding for P-256
    // DER encoding for EC private key on P-256 (secp256r1)
    $der = "\x30\x77" .
        "\x02\x01\x01" . // version
        "\x04\x20" . $privateKeyRaw . // private key (32 bytes)
        "\xa0\x0a\x30\x08\x06\x06" . // parameters: OID for secp256r1
        "\x2b\x81\x04\x00\x0a" . // This needs to be the P-256 OID
        "\xa1\x44\x03\x42\x00\x04" . substr($publicKeyRaw, 1); // public key (uncompressed, skip 0x04 prefix... no)

    // Simpler approach: use openssl_sign with PEM
    $pem = "-----BEGIN EC PRIVATE KEY-----\n" .
        chunk_split(base64_encode(
            "\x30\x41\x02\x01\x00\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x04\x27\x30\x25\x02\x01\x01\x04\x20" . $privateKeyRaw
        ), 64, "\n") .
        "-----END EC PRIVATE KEY-----\n";

    $key = openssl_pkey_get_private($pem);
    if (!$key) {
        error_log("VAPID: Failed to load private key");
        return false;
    }

    $signature = '';
    if (!openssl_sign($signingInput, $signature, $key, OPENSSL_ALGO_SHA256)) {
        error_log("VAPID: Failed to sign JWT");
        return false;
    }

    // Convert DER signature to raw r||s format (64 bytes for ES256)
    $signature = der_to_raw($signature);
    $jwt = $signingInput . '.' . base64url_encode($signature);

    // Encrypt payload using Web Push encryption (aes128gcm)
    $encrypted = encrypt_payload($p256dh, $auth, $payload);
    if (!$encrypted) {
        error_log("Push: Failed to encrypt payload");
        return false;
    }

    // Send via cURL
    $headers = [
        'Authorization: vapid t=' . $jwt . ', k=' . VAPID_PUBLIC_KEY,
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'TTL: 86400',
        'Content-Length: ' . strlen($encrypted),
    ];

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $encrypted);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // 201 = created (success), 410 = gone (subscription expired)
    if ($httpCode === 410 || $httpCode === 404) {
        return false; // Subscription no longer valid
    }

    return ($httpCode >= 200 && $httpCode < 300);
}

/**
 * Encrypt payload using Web Push Content Encryption (aes128gcm)
 */
function encrypt_payload($clientPublicKey, $clientAuth, $payload) {
    $clientPublicKeyRaw = base64url_decode($clientPublicKey);
    $clientAuthRaw = base64url_decode($clientAuth);

    // Generate server key pair
    $serverKey = openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ]);
    if (!$serverKey) return false;

    $serverKeyDetails = openssl_pkey_get_details($serverKey);
    $serverPublicKey = chr(4) . $serverKeyDetails['ec']['x'] . $serverKeyDetails['ec']['y'];

    // Compute shared secret using ECDH
    $sharedSecret = compute_ecdh($serverKey, $clientPublicKeyRaw);
    if (!$sharedSecret) return false;

    // Generate salt
    $salt = random_bytes(16);

    // HKDF for auth
    $authInfo = "WebPush: info\0" . $clientPublicKeyRaw . $serverPublicKey;
    $prk = hash_hmac('sha256', $sharedSecret, $clientAuthRaw, true);
    $ikm = hkdf_expand($prk, $authInfo, 32);

    // HKDF for content encryption key
    $cekInfo = "Content-Encoding: aes128gcm\0";
    $prk2 = hash_hmac('sha256', $ikm, $salt, true);
    $cek = hkdf_expand($prk2, $cekInfo, 16);

    // HKDF for nonce
    $nonceInfo = "Content-Encoding: nonce\0";
    $nonce = hkdf_expand($prk2, $nonceInfo, 12);

    // Pad payload (add delimiter byte \x02)
    $padded = $payload . "\x02";

    // Encrypt with AES-128-GCM
    $tag = '';
    $encrypted = openssl_encrypt(
        $padded, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16
    );
    if ($encrypted === false) return false;

    // Build aes128gcm payload
    // Header: salt(16) + rs(4) + idlen(1) + keyid(65)
    $rs = pack('N', 4096);
    $idlen = chr(65);

    return $salt . $rs . $idlen . $serverPublicKey . $encrypted . $tag;
}

/**
 * Compute ECDH shared secret
 */
function compute_ecdh($serverPrivateKey, $clientPublicKeyRaw) {
    // Extract x, y from uncompressed public key (skip 0x04 prefix)
    $x = substr($clientPublicKeyRaw, 1, 32);
    $y = substr($clientPublicKeyRaw, 33, 32);

    // Build PEM for client public key
    $der = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00" . $clientPublicKeyRaw;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";

    $clientKey = openssl_pkey_get_public($pem);
    if (!$clientKey) {
        error_log("ECDH: Failed to load client public key");
        return false;
    }

    $shared = openssl_pkey_derive($serverPrivateKey, $clientKey, 256);
    return $shared;
}

/**
 * HKDF expand step
 */
function hkdf_expand($prk, $info, $length) {
    $t = '';
    $output = '';
    for ($i = 1; strlen($output) < $length; $i++) {
        $t = hash_hmac('sha256', $t . $info . chr($i), $prk, true);
        $output .= $t;
    }
    return substr($output, 0, $length);
}

/**
 * Convert DER signature to raw r||s format
 */
function der_to_raw($der) {
    $offset = 3; // skip 0x30 + length
    $rLen = ord($der[$offset]);
    $offset++;
    $r = substr($der, $offset, $rLen);
    $offset += $rLen + 1; // skip to s length
    $sLen = ord($der[$offset]);
    $offset++;
    $s = substr($der, $offset, $sLen);

    // Pad/trim to 32 bytes each
    $r = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);

    return $r . $s;
}

/**
 * URL-safe base64 encode
 */
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * URL-safe base64 decode
 */
function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}
