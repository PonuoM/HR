<?php
/**
 * HR Mobile Connect - Auth API
 * Login / session check / password change
 * Security: Device Binding + Session Management
 */
require_once __DIR__ . '/config.php';

$method = get_method();

// --- LOGIN ---
if ($method === 'POST') {
    $body = get_json_body();
    $employee_id = $body['employee_id'] ?? '';
    $password = $body['password'] ?? '';
    $device_fingerprint = $body['device_fingerprint'] ?? null;

    if (!$employee_id || !$password) {
        json_response(['error' => 'กรุณาระบุรหัสพนักงานและรหัสผ่าน'], 400);
    }

    // Look up user
    $stmt = $conn->prepare("SELECT e.*, d.name AS department, p.name AS position, c.id AS company_id, c.code AS company_code, c.name AS company_name, c.logo_url AS company_logo FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN positions p ON e.position_id = p.id LEFT JOIN companies c ON e.company_id = c.id WHERE e.id = ?");
    $stmt->bind_param('s', $employee_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        json_response(['error' => 'ไม่พบรหัสพนักงานนี้'], 401);
    }

    $user = $result->fetch_assoc();

    // Check if suspended
    if (!$user['is_active']) {
        json_response(['error' => 'บัญชีนี้ถูกระงับ กรุณาติดต่อ HR'], 403);
    }

    // Verify password
    if (!password_verify($password, $user['password'])) {
        json_response(['error' => 'รหัสผ่านไม่ถูกต้อง'], 401);
    }

    // ─── LAYER 1: Device Binding ───
    $device_warning = null;
    if ($device_fingerprint) {
        try {
            // Check if this device fingerprint is registered to ANOTHER employee
            $fpCheck = $conn->prepare("SELECT id, name FROM employees WHERE device_fingerprint = ? AND id != ?");
            $fpCheck->bind_param('ss', $device_fingerprint, $employee_id);
            $fpCheck->execute();
            $fpResult = $fpCheck->get_result();

            if ($fpResult->num_rows > 0) {
                // Device belongs to someone else → allow login but create security alert
                $originalOwner = $fpResult->fetch_assoc();
                $device_warning = 'อุปกรณ์นี้เคยลงทะเบียนกับ ' . $originalOwner['name'] . ' (' . $originalOwner['id'] . ')';

                // Create security alert for superadmin
                $alertStmt = $conn->prepare(
                    "INSERT INTO security_alerts (alert_type, employee_id, original_employee_id, device_fingerprint, details) 
                     VALUES ('device_shared', ?, ?, ?, ?)"
                );
                $details = "พนักงาน {$employee_id} ({$user['name']}) ล็อกอินจากอุปกรณ์ที่ลงทะเบียนกับ {$originalOwner['id']} ({$originalOwner['name']})";
                $alertStmt->bind_param('ssss', $employee_id, $originalOwner['id'], $device_fingerprint, $details);
                $alertStmt->execute();
            }

            // Update this employee's device fingerprint (auto-register / re-register)
            $updateFp = $conn->prepare("UPDATE employees SET device_fingerprint = ?, device_registered_at = NOW() WHERE id = ?");
            $updateFp->bind_param('ss', $device_fingerprint, $employee_id);
            $updateFp->execute();
        } catch (Exception $e) {
            // Columns/tables not ready yet → skip device binding
        }
    }

    // ─── LAYER 2: Single Session ───
    $session_token = bin2hex(random_bytes(32));
    try {
        // Delete all existing sessions for this employee (kick old sessions)
        $delSessions = $conn->prepare("DELETE FROM active_sessions WHERE employee_id = ?");
        $delSessions->bind_param('s', $employee_id);
        $delSessions->execute();

        // Create new session
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $insertSession = $conn->prepare(
            "INSERT INTO active_sessions (employee_id, session_token, device_fingerprint, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
        );
        $insertSession->bind_param('sssss', $employee_id, $session_token, $device_fingerprint, $ip, $ua);
        $insertSession->execute();
    } catch (Exception $e) {
        // Table doesn't exist yet → continue without session management
    }

    // Remove password from response
    unset($user['password']);

    $response = [
        'message' => 'เข้าสู่ระบบสำเร็จ',
        'user' => $user,
        'company' => [
            'id' => (int)($user['company_id'] ?? 1),
            'code' => $user['company_code'] ?? 'PRM',
            'name' => $user['company_name'] ?? 'Primapassion49',
            'logo_url' => $user['company_logo'] ?? null,
        ],
        'token' => $session_token,
    ];

    if ($device_warning) {
        $response['device_warning'] = $device_warning;
    }

    json_response($response);
}

// --- VALIDATE SESSION ---
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'validate_session') {
    $token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? $_SERVER['http_x_session_token'] ?? '';
    if (!$token) {
        // No token → skip validation (table may not exist yet)
        json_response(['valid' => true]);
    }

    try {
        $stmt = $conn->prepare("SELECT s.*, e.name AS employee_name FROM active_sessions s JOIN employees e ON s.employee_id = e.id WHERE s.session_token = ?");
        $stmt->bind_param('s', $token);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            json_response(['valid' => false, 'error' => 'session หมดอายุหรือถูกเข้าสู่ระบบจากอุปกรณ์อื่น'], 401);
        }

        // Update last_active_at
        $updateStmt = $conn->prepare("UPDATE active_sessions SET last_active_at = NOW() WHERE session_token = ?");
        $updateStmt->bind_param('s', $token);
        $updateStmt->execute();

        json_response(['valid' => true]);
    } catch (Exception $e) {
        // Table doesn't exist yet → treat as valid (migration not run)
        json_response(['valid' => true]);
    }
}

// --- LOGOUT ---
if ($method === 'DELETE') {
    $token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? $_SERVER['http_x_session_token'] ?? '';
    if ($token) {
        $stmt = $conn->prepare("DELETE FROM active_sessions WHERE session_token = ?");
        $stmt->bind_param('s', $token);
        $stmt->execute();
    }
    json_response(['message' => 'ออกจากระบบเรียบร้อย']);
}

// --- CHANGE PASSWORD ---
if ($method === 'PUT') {
    $body = get_json_body();
    $employee_id = $body['employee_id'] ?? '';
    $current_password = $body['current_password'] ?? '';
    $new_password = $body['new_password'] ?? '';

    if (!$employee_id || !$current_password || !$new_password) {
        json_response(['error' => 'กรุณากรอกข้อมูลให้ครบ'], 400);
    }

    if (strlen($new_password) < 4) {
        json_response(['error' => 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร'], 400);
    }

    // Get current password hash
    $stmt = $conn->prepare("SELECT password FROM employees WHERE id = ?");
    $stmt->bind_param('s', $employee_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        json_response(['error' => 'ไม่พบพนักงาน'], 404);
    }

    $row = $result->fetch_assoc();

    // Verify current password
    if (!password_verify($current_password, $row['password'])) {
        json_response(['error' => 'รหัสผ่านปัจจุบันไม่ถูกต้อง'], 401);
    }

    // Hash and update new password
    $newHash = password_hash($new_password, PASSWORD_BCRYPT);
    $stmt2 = $conn->prepare("UPDATE employees SET password = ? WHERE id = ?");
    $stmt2->bind_param('ss', $newHash, $employee_id);
    $stmt2->execute();

    json_response(['message' => 'เปลี่ยนรหัสผ่านเรียบร้อย']);
}

json_response(['error' => 'Invalid request'], 405);
