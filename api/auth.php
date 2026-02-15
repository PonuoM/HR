<?php
/**
 * HR Mobile Connect - Auth API
 * Login / session check
 */
require_once __DIR__ . '/config.php';

$method = get_method();

// --- LOGIN ---
if ($method === 'POST') {
    $body = get_json_body();
    $employee_id = $body['employee_id'] ?? '';
    $password = $body['password'] ?? '';

    if (!$employee_id || !$password) {
        json_response(['error' => 'กรุณาระบุรหัสพนักงานและรหัสผ่าน'], 400);
    }

    $stmt = $conn->prepare("
        SELECT e.id, e.name, e.email, e.password, e.avatar, e.is_admin, e.is_active,
               d.name AS department, p.name AS position, e.employment_type
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN positions p ON e.position_id = p.id
        WHERE e.id = ?
    ");
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

    // Remove password from response
    unset($user['password']);

    // Generate a simple session token
    $token = bin2hex(random_bytes(32));

    json_response([
        'message' => 'เข้าสู่ระบบสำเร็จ',
        'user' => $user,
        'token' => $token,
    ]);
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
