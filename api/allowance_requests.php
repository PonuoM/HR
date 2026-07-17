<?php
/**
 * Allowance (Per Diem) Requests API — Multi-tier Approval
 * GET    /api/allowance_requests.php?employee_id=X         - List requests for employee
 * GET    /api/allowance_requests.php?approver_id=X         - Pending for approver
 * GET    /api/allowance_requests.php?action=types          - Get allowance types
 * POST   /api/allowance_requests.php                       - Create new request
 * PUT    /api/allowance_requests.php?id=X                  - Approve/reject
 */
require_once __DIR__ . '/config.php';

// Load push notification helper safely
$_push_available = false;
try {
    require_once __DIR__ . '/send_push.php';
    $_push_available = function_exists('send_push_to_employee');
} catch (Throwable $e) {
    error_log('Push module load failed: ' . $e->getMessage());
}

function safe_send_push_al($conn, $employee_id, $title, $body) {
    global $_push_available;
    if (!$_push_available) return;
    try {
        send_push_to_employee($conn, $employee_id, $title, $body);
    } catch (Throwable $e) {
        error_log('Push send failed: ' . $e->getMessage());
    }
}

function create_notification_al($conn, $employee_id, $title, $message, $icon = 'notifications', $icon_bg = 'bg-blue-100 dark:bg-blue-900/30', $type = 'allowance', $icon_color = 'text-blue-600') {
    $stmt = $conn->prepare("INSERT INTO notifications (employee_id, title, message, icon, icon_bg, type, icon_color) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssssss', $employee_id, $title, $message, $icon, $icon_bg, $type, $icon_color);
    $stmt->execute();
}

$method = get_method();
$company_id = get_company_id();

// ─── Auto-migrate: ensure new columns exist ───
try {
    // Location columns
    $colCheck = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'allowance_requests' AND COLUMN_NAME = 'location_address'");
    if ($colCheck && $colCheck->num_rows === 0) {
        @$conn->query("ALTER TABLE allowance_requests ADD COLUMN location_address TEXT DEFAULT NULL AFTER location_name");
        @$conn->query("ALTER TABLE allowance_requests ADD COLUMN location_detail TEXT DEFAULT NULL AFTER location_address");
        @$conn->query("ALTER TABLE allowance_requests ADD COLUMN location_link VARCHAR(500) DEFAULT NULL AFTER location_detail");
        @$conn->query("ALTER TABLE allowance_requests ADD COLUMN location_lat DECIMAL(10,7) DEFAULT NULL AFTER location_link");
        @$conn->query("ALTER TABLE allowance_requests ADD COLUMN location_lng DECIMAL(10,7) DEFAULT NULL AFTER location_lat");
    }

    // Date columns: rename request_date → start_date, add end_date
    $startDateCheck = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'allowance_requests' AND COLUMN_NAME = 'start_date'");
    if ($startDateCheck && $startDateCheck->num_rows === 0) {
        // Check if old request_date exists
        $oldDateCheck = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'allowance_requests' AND COLUMN_NAME = 'request_date'");
        if ($oldDateCheck && $oldDateCheck->num_rows > 0) {
            @$conn->query("ALTER TABLE allowance_requests CHANGE COLUMN request_date start_date DATE NOT NULL");
        } else {
            @$conn->query("ALTER TABLE allowance_requests ADD COLUMN start_date DATE NOT NULL AFTER location_lng");
        }
    }
    $endDateCheck = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'allowance_requests' AND COLUMN_NAME = 'end_date'");
    if ($endDateCheck && $endDateCheck->num_rows === 0) {
        @$conn->query("ALTER TABLE allowance_requests ADD COLUMN end_date DATE DEFAULT NULL AFTER start_date");
    }
} catch (Throwable $e) {
    error_log('Allowance auto-migrate failed: ' . $e->getMessage());
}


if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'types') {
    $result = $conn->query("SELECT id, name FROM allowance_types WHERE company_id = $company_id AND is_active = 1 ORDER BY name");
    $types = [];
    while ($row = $result->fetch_assoc()) $types[] = $row;
    json_response($types);
}

// ─── GET: List requests ───
if ($method === 'GET') {
    // Check if caller is superadmin (cross-company access)
    $employee_id_header = get_employee_id();
    $is_superadmin = is_admin_user($conn, $employee_id_header);

    $where = [];
    $params = [];
    $types = '';

    // Non-superadmin: scope to their company, plus any request tied to the caller
    // personally as approver/actor — approvees may be in another company
    if (!$is_superadmin) {
        if ($employee_id_header !== '') {
            $where[] = '(e.company_id = ? OR ar.expected_approver1_id = ? OR ar.expected_approver2_id = ? OR ar.tier1_by = ? OR ar.tier2_by = ?)';
            $params[] = $company_id;
            $params[] = $employee_id_header;
            $params[] = $employee_id_header;
            $params[] = $employee_id_header;
            $params[] = $employee_id_header;
            $types .= 'issss';
        } else {
            $where[] = 'e.company_id = ?';
            $params[] = $company_id;
            $types .= 'i';
        }
    }

    if (isset($_GET['employee_id'])) {
        $where[] = 'ar.employee_id = ?';
        $params[] = $_GET['employee_id'];
        $types .= 's';
    }
    if (isset($_GET['status'])) {
        $where[] = 'ar.status = ?';
        $params[] = $_GET['status'];
        $types .= 's';
    }
    if (isset($_GET['approver_id'])) {
        $appId = $_GET['approver_id'];
        $where[] = "(
            (ar.expected_approver1_id = ? AND ar.tier1_status = 'pending' AND ar.status = 'pending')
            OR (ar.expected_approver2_id = ? AND ar.tier1_status = 'approved' AND ar.tier2_status = 'pending' AND ar.status = 'pending')
            OR (ar.tier1_by = ?)
            OR (ar.tier2_by = ?)
        )";
        $params[] = $appId;
        $params[] = $appId;
        $params[] = $appId;
        $params[] = $appId;
        $types .= 'ssss';
    }

    $whereSQL = count($where) > 0 ? implode(' AND ', $where) : '1=1';
    $sql = "SELECT ar.*,
                CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS employee_name, e.avatar AS employee_avatar,
                e.approver_id, e.approver2_id,
                CONCAT(a1.name, IF(IFNULL(a1.nickname, '') != '', CONCAT(' (', a1.nickname, ')'), '')) AS approver1_name,
                CONCAT(a2.name, IF(IFNULL(a2.nickname, '') != '', CONCAT(' (', a2.nickname, ')'), '')) AS approver2_name,
                c.name AS company_name, c.code AS company_code
            FROM allowance_requests ar
            JOIN employees e ON ar.employee_id COLLATE utf8mb4_unicode_ci = e.id COLLATE utf8mb4_unicode_ci
            LEFT JOIN companies c ON e.company_id = c.id
            LEFT JOIN employees a1 ON ar.expected_approver1_id COLLATE utf8mb4_unicode_ci = a1.id COLLATE utf8mb4_unicode_ci
            LEFT JOIN employees a2 ON ar.expected_approver2_id COLLATE utf8mb4_unicode_ci = a2.id COLLATE utf8mb4_unicode_ci
            WHERE $whereSQL
            ORDER BY ar.created_at DESC
            LIMIT 200";

    try {
        if (count($params) > 0) {
            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();
        } else {
            $result = $conn->query($sql);
        }

        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        json_response($rows);
    } catch (Throwable $e) {
        json_response(['error' => 'Internal server error'], 500);
    }
}

// ─── POST: Create ───
if ($method === 'POST') {
    $body = get_json_body();
    $employee_id = $conn->real_escape_string($body['employee_id'] ?? '');
    $allowance_type = $conn->real_escape_string($body['allowance_type'] ?? '');
    $location_name = $conn->real_escape_string($body['location_name'] ?? '');
    $location_address = $conn->real_escape_string($body['location_address'] ?? '');
    $location_detail = $conn->real_escape_string($body['location_detail'] ?? '');
    $location_link = $conn->real_escape_string($body['location_link'] ?? '');
    $location_lat = isset($body['location_lat']) && $body['location_lat'] !== null ? (float)$body['location_lat'] : null;
    $location_lng = isset($body['location_lng']) && $body['location_lng'] !== null ? (float)$body['location_lng'] : null;
    $start_date = $conn->real_escape_string($body['start_date'] ?? '');
    $end_date = !empty($body['end_date']) ? $conn->real_escape_string($body['end_date']) : $start_date;
    $start_time = !empty($body['start_time']) ? $conn->real_escape_string($body['start_time']) : null;
    $end_time = !empty($body['end_time']) ? $conn->real_escape_string($body['end_time']) : null;
    $amount = isset($body['amount']) ? (float)$body['amount'] : 0;
    $reason = $conn->real_escape_string($body['reason'] ?? '');

    if (!$employee_id || !$allowance_type || !$start_date || $amount <= 0) {
        json_response(['error' => 'employee_id, allowance_type, start_date, and amount > 0 are required'], 400);
    }

    // Auto-save new allowance type if not exists
    $typeCheck = $conn->prepare("SELECT id FROM allowance_types WHERE name = ? AND company_id = ?");
    $typeCheck->bind_param('si', $allowance_type, $company_id);
    $typeCheck->execute();
    if ($typeCheck->get_result()->num_rows === 0) {
        $insertType = $conn->prepare("INSERT INTO allowance_types (name, company_id) VALUES (?, ?)");
        $insertType->bind_param('si', $allowance_type, $company_id);
        $insertType->execute();
    }

    // Look up approvers from employee record
    $empStmt = $conn->prepare("SELECT CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS name, e.approver_id, e.approver2_id FROM employees e WHERE e.id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $emp = $empStmt->get_result()->fetch_assoc();

    $approver1_id = $emp['approver_id'] ?? null;
    $approver2_id = $emp['approver2_id'] ?? null;

    $stmt = $conn->prepare("INSERT INTO allowance_requests (employee_id, allowance_type, location_name, location_address, location_detail, location_link, location_lat, location_lng, start_date, end_date, start_time, end_time, amount, reason, expected_approver1_id, expected_approver2_id, tier1_status, tier2_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending')");
    $lat_str = $location_lat !== null ? (string)$location_lat : null;
    $lng_str = $location_lng !== null ? (string)$location_lng : null;
    $amount_str = (string)$amount;
    $stmt->bind_param('ssssssssssssssss',
        $employee_id, $allowance_type, $location_name, $location_address, $location_detail, $location_link,
        $lat_str, $lng_str, $start_date, $end_date,
        $start_time, $end_time, $amount_str, $reason,
        $approver1_id, $approver2_id
    );
    $stmt->execute();
    $newId = $conn->insert_id;

    // Notify tier-1 approver
    if ($approver1_id) {
        create_notification_al($conn, $approver1_id,
            'คำขอเบี้ยเลี้ยงรออนุมัติ',
            ($emp['name'] ?? $employee_id) . " ส่งคำขอเบี้ยเลี้ยง ฿" . number_format($amount, 2) . " รอการอนุมัติของคุณ",
            'savings',
            'bg-amber-100 dark:bg-amber-900/30',
            'allowance',
            'text-amber-600'
        );
        safe_send_push_al($conn, $approver1_id, 'คำขอเบี้ยเลี้ยงรออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอเบี้ยเลี้ยง ฿" . number_format($amount, 2));
    } else {
        // No specific approver — notify all HR admins
        $hrResult = $conn->query("SELECT id FROM employees WHERE is_admin = 1 AND is_active = 1 AND company_id = $company_id");
        while ($hr = $hrResult->fetch_assoc()) {
            create_notification_al($conn, $hr['id'],
                'คำขอเบี้ยเลี้ยงรออนุมัติ',
                ($emp['name'] ?? $employee_id) . " ส่งคำขอเบี้ยเลี้ยง ฿" . number_format($amount, 2) . " (ไม่มีผู้อนุมัติขั้น 1)",
                'savings',
                'bg-amber-100 dark:bg-amber-900/30',
                'allowance',
                'text-amber-600'
            );
            safe_send_push_al($conn, $hr['id'], 'คำขอเบี้ยเลี้ยงรออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอเบี้ยเลี้ยง ฿" . number_format($amount, 2));
        }
    }

    json_response(['id' => $newId, 'message' => 'Allowance request created'], 201);
}

// ─── PUT: Approve / Reject ───
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $body = get_json_body();
    $action = $body['status'] ?? '';
    $actorId = $conn->real_escape_string($body['approved_by'] ?? '');

    if (!in_array($action, ['approved', 'rejected'])) {
        json_response(['error' => 'Invalid status'], 400);
    }

    // Fetch current request
    $req = $conn->query("SELECT * FROM allowance_requests WHERE id = $id")->fetch_assoc();
    if (!$req) json_response(['error' => 'Not found'], 404);

    // Prevent self-approval
    if ($actorId === $req['employee_id']) {
        json_response(['error' => 'ไม่สามารถอนุมัติคำขอตัวเองได้'], 403);
    }

    // Get actor name
    $actorRow = $conn->query("SELECT CONCAT(name, IF(IFNULL(nickname, '') != '', CONCAT(' (', nickname, ')'), '')) AS name FROM employees WHERE id = '$actorId'")->fetch_assoc();
    $actorName = $actorRow['name'] ?? $actorId;
    $isHR = is_admin_user($conn, $actorId);

    $tier1Approver = $req['expected_approver1_id'];
    $tier2Approver = $req['expected_approver2_id'];

    // ── REJECTION ──
    if ($action === 'rejected') {
        $conn->query("UPDATE allowance_requests SET status='rejected', approved_by='$actorId', approved_at=NOW() WHERE id=$id");
        create_notification_al($conn, $req['employee_id'],
            'คำขอเบี้ยเลี้ยงถูกปฏิเสธ',
            "คำขอเบี้ยเลี้ยงของคุณถูกปฏิเสธโดย {$actorName}",
            'cancel', 'bg-red-100 dark:bg-red-900/30', 'allowance', 'text-red-600'
        );
        safe_send_push_al($conn, $req['employee_id'], 'คำขอเบี้ยเลี้ยงถูกปฏิเสธ', "คำขอเบี้ยเลี้ยงถูกปฏิเสธโดย {$actorName}");
        json_response(['message' => 'Rejected']);
    }

    // ── APPROVAL ──
    if ($action === 'approved') {


        // TIER 1 APPROVAL
        if ($actorId === $tier1Approver && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE allowance_requests SET tier1_status='approved', tier1_by='$actorId', tier1_at=NOW() WHERE id=$id");

            // If no tier2 approver → auto-approve
            if (!$tier2Approver) {
                $conn->query("UPDATE allowance_requests SET
                    tier2_status='approved',
                    status='approved', approved_by='$actorId', approved_at=NOW()
                    WHERE id=$id");
                create_notification_al($conn, $req['employee_id'],
                    'เบี้ยเลี้ยงอนุมัติแล้ว',
                    "คำขอเบี้ยเลี้ยงของคุณได้รับการอนุมัติโดย {$actorName}",
                    'check_circle', 'bg-green-100 dark:bg-green-900/30', 'allowance', 'text-green-600'
                );
                safe_send_push_al($conn, $req['employee_id'], 'เบี้ยเลี้ยงอนุมัติแล้ว', "คำขอเบี้ยเลี้ยงอนุมัติโดย {$actorName}");
                json_response(['message' => 'Approved (no tier 2)']);
            }

            // Notify tier2
            create_notification_al($conn, $tier2Approver,
                'คำขอเบี้ยเลี้ยงรออนุมัติขั้น 2',
                ($req['employee_id']) . " คำขอเบี้ยเลี้ยงผ่านขั้น 1 แล้ว รอการอนุมัติของคุณ",
                'savings', 'bg-amber-100 dark:bg-amber-900/30', 'allowance', 'text-amber-600'
            );
            safe_send_push_al($conn, $tier2Approver, 'คำขอเบี้ยเลี้ยงรออนุมัติขั้น 2', "คำขอเบี้ยเลี้ยงผ่านขั้น 1 แล้ว");
            json_response(['message' => 'Tier 1 approved']);
        }

        // TIER 2 APPROVAL (after tier1 approved)
        if ($actorId === $tier2Approver && $req['tier1_status'] === 'approved') {
            $conn->query("UPDATE allowance_requests SET
                tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                status='approved', approved_by='$actorId', approved_at=NOW()
                WHERE id=$id");
            create_notification_al($conn, $req['employee_id'],
                'เบี้ยเลี้ยงอนุมัติแล้ว',
                "คำขอเบี้ยเลี้ยงของคุณได้รับการอนุมัติโดย {$actorName}",
                'check_circle', 'bg-green-100 dark:bg-green-900/30', 'allowance', 'text-green-600'
            );
            safe_send_push_al($conn, $req['employee_id'], 'เบี้ยเลี้ยงอนุมัติแล้ว', "คำขอเบี้ยเลี้ยงอนุมัติโดย {$actorName}");
            json_response(['message' => 'Approved']);
        }

        // Fallback
        $conn->query("UPDATE allowance_requests SET status='approved', approved_by='$actorId', approved_at=NOW() WHERE id=$id");
        json_response(['message' => 'Updated']);
    }

    json_response(['error' => 'Invalid action'], 400);
}

json_response(['error' => 'Method not allowed'], 405);
