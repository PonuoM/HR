<?php
/**
 * Face Recognition API
 * POST   /api/face.php                  - Register face descriptor
 * GET    /api/face.php?employee_id=X    - Get face descriptor
 * DELETE /api/face.php?employee_id=X    - Remove face registration (admin only)
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

// ─── POST: Register face descriptor ───
if ($method === 'POST') {
    $body = get_json_body();
    $employee_id = $body['employee_id'] ?? '';
    $descriptor = $body['descriptor'] ?? null; // Single 128-float array OR array of multiple descriptors
    $descriptors = $body['descriptors'] ?? null; // Multiple descriptors from multi-angle capture

    if (!$employee_id) {
        json_response(['error' => 'employee_id is required'], 400);
    }

    // Support multi-descriptor: average them into one
    if ($descriptors && is_array($descriptors) && count($descriptors) > 0) {
        $len = count($descriptors[0]);
        $avg = array_fill(0, $len, 0.0);
        foreach ($descriptors as $d) {
            for ($i = 0; $i < $len; $i++) {
                $avg[$i] += floatval($d[$i]);
            }
        }
        $count = count($descriptors);
        for ($i = 0; $i < $len; $i++) {
            $avg[$i] = $avg[$i] / $count;
        }
        $descriptor = $avg;
    }

    if (!$descriptor || !is_array($descriptor)) {
        json_response(['error' => 'descriptor or descriptors (array) are required'], 400);
    }

    if (count($descriptor) !== 128) {
        json_response(['error' => 'Descriptor must be 128-dimensional'], 400);
    }

    // Verify all values are numeric
    foreach ($descriptor as $val) {
        if (!is_numeric($val)) {
            json_response(['error' => 'All descriptor values must be numeric'], 400);
        }
    }

    // Store as JSON string
    $descriptorJson = json_encode($descriptor);

    $stmt = $conn->prepare("UPDATE employees SET face_descriptor = ?, face_registered_at = NOW() WHERE id = ? AND company_id = ?");
    $stmt->bind_param('ssi', $descriptorJson, $employee_id, $company_id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        json_response(['error' => 'ไม่พบพนักงาน'], 404);
    }

    json_response(['message' => 'ลงทะเบียนใบหน้าเรียบร้อย', 'employee_id' => $employee_id]);
}

// ─── GET: Get face descriptor ───
if ($method === 'GET') {
    $employee_id = $_GET['employee_id'] ?? '';

    if (!$employee_id) {
        json_response(['error' => 'employee_id is required'], 400);
    }

    $stmt = $conn->prepare("SELECT face_descriptor, face_registered_at FROM employees WHERE id = ?");
    $stmt->bind_param('s', $employee_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        json_response(['error' => 'ไม่พบพนักงาน'], 404);
    }

    $row = $result->fetch_assoc();

    json_response([
        'employee_id' => $employee_id,
        'has_face' => !empty($row['face_descriptor']),
        'descriptor' => $row['face_descriptor'] ? json_decode($row['face_descriptor']) : null,
        'registered_at' => $row['face_registered_at'],
    ]);
}

// ─── DELETE: Remove face registration ───
if ($method === 'DELETE') {
    // Check if caller is admin
    $headers = getallheaders();
    $caller_id = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? null;
    if ($caller_id) {
        $adminCheck = $conn->prepare("SELECT is_admin, is_superadmin FROM employees WHERE id = ?");
        $adminCheck->bind_param('s', $caller_id);
        $adminCheck->execute();
        $adminRow = $adminCheck->get_result()->fetch_assoc();
        if (!$adminRow || (!$adminRow['is_admin'] && !$adminRow['is_superadmin'])) {
            json_response(['error' => 'ต้องเป็น Admin เท่านั้น'], 403);
        }
    }

    $employee_id = $_GET['employee_id'] ?? '';
    if (!$employee_id) {
        json_response(['error' => 'employee_id is required'], 400);
    }

    $stmt = $conn->prepare("UPDATE employees SET face_descriptor = NULL, face_registered_at = NULL WHERE id = ?");
    $stmt->bind_param('s', $employee_id);
    $stmt->execute();

    json_response(['message' => 'ลบข้อมูลใบหน้าเรียบร้อย']);
}

json_response(['error' => 'Method not allowed'], 405);
