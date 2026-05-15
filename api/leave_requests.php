<?php
/**
 * Leave Requests API (v2 — Multi-tier Approval)
 * GET  /api/leave_requests.php                - List all (admin) or by employee_id
 * GET  /api/leave_requests.php?employee_id=X  - Filter by employee
 * GET  /api/leave_requests.php?status=pending - Filter by status
 * GET  /api/leave_requests.php?approver_id=X  - Filter by pending approver
 * POST /api/leave_requests.php                - Create a new leave request
 * PUT  /api/leave_requests.php?id=X           - Multi-tier approve/reject
 */
require_once __DIR__ . '/config.php';

// Load push notification helper safely — push failures must never break core functionality
$_push_available = false;
try {
    require_once __DIR__ . '/send_push.php';
    $_push_available = function_exists('send_push_to_employee');
} catch (Throwable $e) {
    error_log('Push module load failed: ' . $e->getMessage());
}

// Safe wrapper: push notification errors should never cause 500 on leave requests
function safe_send_push($conn, $employee_id, $title, $body) {
    global $_push_available;
    if (!$_push_available) return;
    try {
        send_push_to_employee($conn, $employee_id, $title, $body);
    } catch (Throwable $e) {
        error_log('Push send failed: ' . $e->getMessage());
    }
}

$method = get_method();

// ─── Helper: insert notification ───
function create_notification($conn, $employee_id, $title, $message, $icon = 'notifications', $icon_bg = 'bg-blue-100 dark:bg-blue-900/30', $type = 'leave', $icon_color = 'text-blue-600') {
    $stmt = $conn->prepare("INSERT INTO notifications (employee_id, title, message, icon, icon_bg, type, icon_color) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssssss', $employee_id, $title, $message, $icon, $icon_bg, $type, $icon_color);
    $stmt->execute();
}

// ─── GET ───
if ($method === 'GET') {
    $company_id = get_company_id();
    $employee_id_header = get_employee_id();

    // Check if caller is superadmin (cross-company access)
    $is_superadmin = false;
    if ($employee_id_header) {
        $saCheck = $conn->prepare("SELECT is_superadmin FROM employees WHERE id = ?");
        $saCheck->bind_param('s', $employee_id_header);
        $saCheck->execute();
        $saRow = $saCheck->get_result()->fetch_assoc();
        $is_superadmin = $saRow && $saRow['is_superadmin'];
    }

    $where = [];
    $params = [];
    $types = '';

    // Non-superadmin: scope to their company only
    if (!$is_superadmin) {
        $where[] = 'e.company_id = ?';
        $params[] = $company_id;
        $types .= 'i';
    }

    if (isset($_GET['id'])) {
        $where[] = 'lr.id = ?';
        $params[] = $_GET['id'];
        $types .= 's';
    }
    if (isset($_GET['employee_id'])) {
        $where[] = 'lr.employee_id = ?';
        $params[] = $_GET['employee_id'];
        $types .= 's';
    }
    if (isset($_GET['status'])) {
        $where[] = 'lr.status = ?';
        $params[] = $_GET['status'];
        $types .= 's';
    }
    if (isset($_GET['approver_id'])) {
        $approver_id = $_GET['approver_id'];
        // Show: 1) pending items where it's this user's turn to approve
        //        2) items this user already acted on (for history)
        $where[] = '(
            (lr.expected_approver1_id = ? AND lr.tier1_status = "pending" AND lr.status = "pending")
            OR (lr.expected_approver2_id = ? AND lr.tier1_status = "approved" AND lr.tier2_status = "pending" AND lr.status = "pending")
            OR (lr.tier1_by = ?)
            OR (lr.tier2_by = ?)
        )';
        $params[] = $approver_id;
        $params[] = $approver_id;
        $params[] = $approver_id;
        $params[] = $approver_id;
        $types .= 'ssss';
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "SELECT lr.*, 
                   CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS employee_name, 
                   e.avatar AS employee_avatar,
                   e.approver_id, e.approver2_id,
                   IFNULL(lt.name, IF(lr.leave_type_id = 0 OR lr.leave_type_id IS NULL, 'ล่วงเวลา (OT)', 'ไม่ระบุ')) AS leave_type_name, 
                   IFNULL(lt.color, IF(lr.leave_type_id = 0 OR lr.leave_type_id IS NULL, 'violet', 'gray')) AS leave_type_color,
                   d.name AS department,
                   CONCAT(a1.name, IF(IFNULL(a1.nickname, '') != '', CONCAT(' (', a1.nickname, ')'), '')) AS approver1_name, a1.avatar AS approver1_avatar,
                   CONCAT(a2.name, IF(IFNULL(a2.nickname, '') != '', CONCAT(' (', a2.nickname, ')'), '')) AS approver2_name, a2.avatar AS approver2_avatar,
                   CONCAT(t1.name, IF(IFNULL(t1.nickname, '') != '', CONCAT(' (', t1.nickname, ')'), '')) AS tier1_by_name, 
                   CONCAT(t2.name, IF(IFNULL(t2.nickname, '') != '', CONCAT(' (', t2.nickname, ')'), '')) AS tier2_by_name,
                   c.name AS company_name, c.code AS company_code
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            LEFT JOIN companies c ON e.company_id = c.id
            LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN employees a1 ON lr.expected_approver1_id = a1.id
            LEFT JOIN employees a2 ON lr.expected_approver2_id = a2.id
            LEFT JOIN employees t1 ON lr.tier1_by = t1.id
            LEFT JOIN employees t2 ON lr.tier2_by = t2.id
            $whereClause
            ORDER BY lr.created_at DESC";

    if (count($params) > 0) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }

    $requests = [];
    while ($row = $result->fetch_assoc()) {
        $requests[] = $row;
    }
    json_response($requests);
}

// ─── POST (Create) ───
if ($method === 'POST') {
    // ─── HR-only: quick-update OT rate on an approved leave_request ───
    // POST /api/leave_requests.php?action=update_ot_rate&id=X  body: { ot_rate: 1.5 }
    if (($_GET['action'] ?? '') === 'update_ot_rate') {
        require_admin($conn);
        $id = (int)($_GET['id'] ?? 0);
        $body = get_json_body();
        $rate = isset($body['ot_rate']) && $body['ot_rate'] !== null ? (float)$body['ot_rate'] : null;
        if (!$id) json_response(['error' => 'Missing id'], 400);
        if ($rate === null || !in_array($rate, [1.0, 1.5, 2.0, 3.0], true)) {
            json_response(['error' => 'ot_rate ต้องเป็น 1, 1.5, 2 หรือ 3'], 400);
        }
        $stmt = $conn->prepare("UPDATE leave_requests SET ot_rate = ? WHERE id = ? AND reason LIKE '[OT]%'");
        $stmt->bind_param('di', $rate, $id);
        $stmt->execute();
        if ($stmt->affected_rows === 0) {
            json_response(['error' => 'ไม่พบใบ OT (id=' . $id . ')'], 404);
        }
        json_response(['message' => 'OT rate updated', 'id' => $id, 'ot_rate' => $rate]);
    }

    $body = get_json_body();
    $employee_id = $body['employee_id'];

    // ─── Admin-create mode: HR records leave on behalf of an employee ───
    // Bypasses approval flow → status='approved', is_bypass=1, approved_by=admin
    $admin_create = !empty($body['admin_create']);
    $admin_actor_id = null;
    if ($admin_create) {
        $admin_actor_id = require_admin($conn);
        if ($admin_actor_id === $employee_id) {
            json_response(['error' => 'ไม่สามารถบันทึกการลาให้ตัวเองได้'], 403);
        }
    }

    // Detect OT request (frontend sends leave_type_id = 0)
    $isOT = (isset($body['leave_type_id']) && intval($body['leave_type_id']) === 0)
         || (isset($body['reason']) && strpos($body['reason'], '[OT]') === 0);

    // Look up approvers from employee record
    $empStmt = $conn->prepare("SELECT CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS name, e.approver_id, e.approver2_id, CONCAT(a1.name, IF(IFNULL(a1.nickname, '') != '', CONCAT(' (', a1.nickname, ')'), '')) AS approver1_name FROM employees e LEFT JOIN employees a1 ON e.approver_id = a1.id WHERE e.id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $emp = $empStmt->get_result()->fetch_assoc();

    $approver1_id = $emp['approver_id'] ?? null;
    $approver2_id = $emp['approver2_id'] ?? null;

    // Promote Tier 2 to Tier 1 if Tier 1 is missing
    if (!$approver1_id && $approver2_id) {
        $approver1_id = $approver2_id;
        $approver2_id = null;
    }

    // For OT requests, leave_type_id must be NULL (FK constraint doesn't allow 0)
    $leaveTypeId = $isOT ? null : $body['leave_type_id'];

    // OT rate (multiplier) — only meaningful for OT entries. Default 1.0 if not provided.
    $otRate = null;
    if ($isOT) {
        $otRate = isset($body['ot_rate']) ? (float)$body['ot_rate'] : 1.0;
        if (!in_array($otRate, [1.0, 1.5, 2.0, 3.0], true)) $otRate = 1.0;
    }

    if ($admin_create) {
        // HR-recorded leave: insert as already-approved with is_bypass=1
        // Params: employee_id(s) leave_type_id(i) start(s) end(s) days(s) ot_rate(d) reason(s)
        //         approver1(s) approver2(s) admin(s) admin(s) admin(s) = 12 params
        $stmt = $conn->prepare(
            "INSERT INTO leave_requests
             (employee_id, leave_type_id, start_date, end_date, total_days, ot_rate, reason,
              expected_approver1_id, expected_approver2_id,
              status, tier1_status, tier2_status, is_bypass, approved_by, approved_at,
              tier1_by, tier1_at, tier2_by, tier2_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'skipped', 'skipped', 1, ?, NOW(), ?, NOW(), ?, NOW())"
        );
        $stmt->bind_param('sisssdsssss' . 's',
            $body['employee_id'], $leaveTypeId,
            $body['start_date'], $body['end_date'],
            $body['total_days'], $otRate, $body['reason'],
            $approver1_id, $approver2_id,
            $admin_actor_id, $admin_actor_id, $admin_actor_id
        );
        $stmt->execute();
    } else {
        // Params: employee_id(s) leave_type_id(i) start(s) end(s) days(s) ot_rate(d) reason(s)
        //         approver1(s) approver2(s) = 9 params
        $stmt = $conn->prepare("INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, ot_rate, reason, expected_approver1_id, expected_approver2_id, tier1_status, tier2_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')");
        $stmt->bind_param('sisssdsss',
            $body['employee_id'], $leaveTypeId,
            $body['start_date'], $body['end_date'],
            $body['total_days'], $otRate, $body['reason'],
            $approver1_id, $approver2_id
        );
        $stmt->execute();
    }
    $newId = $conn->insert_id;

    // Look up leave type name for notification
    $leaveTypeName = 'ลา';
    if (!$isOT && $leaveTypeId) {
        $ltStmt = $conn->prepare("SELECT name FROM leave_types WHERE id = ?");
        $ltStmt->bind_param('i', $leaveTypeId);
        $ltStmt->execute();
        $lt = $ltStmt->get_result()->fetch_assoc();
        $leaveTypeName = $lt['name'] ?? 'ลา';
    }
    $requestType = $isOT ? 'ขอ OT' : $leaveTypeName;

    if ($admin_create) {
        // ── Notify the EMPLOYEE that HR recorded leave for them ──
        $actorStmt = $conn->prepare("SELECT name FROM employees WHERE id = ?");
        $actorStmt->bind_param('s', $admin_actor_id);
        $actorStmt->execute();
        $actorRow = $actorStmt->get_result()->fetch_assoc();
        $actorName = $actorRow['name'] ?? $admin_actor_id;
        create_notification($conn, $employee_id,
            'HR บันทึกการลาให้คุณ',
            "{$actorName} บันทึก{$requestType} ให้คุณ ({$body['total_days']} วัน)",
            'event_available',
            'bg-blue-100 dark:bg-blue-900/30',
            'leave',
            'text-blue-600'
        );
        safe_send_push($conn, $employee_id, 'HR บันทึกการลาให้คุณ', "{$actorName} บันทึก{$requestType} ({$body['total_days']} วัน)");
    } elseif ($approver1_id) {
        // Notify tier-1 approver
        create_notification($conn, $approver1_id,
            'คำขอรออนุมัติ',
            ($emp['name'] ?? $employee_id) . " ส่งคำขอ{$requestType} รอการอนุมัติของคุณ",
            'pending_actions',
            'bg-amber-100 dark:bg-amber-900/30',
            'leave',
            'text-amber-600'
        );
        safe_send_push($conn, $approver1_id, 'คำขอรออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอ{$requestType} รอการอนุมัติของคุณ");
    } else {
        // No specific approver — notify all HR admins
        $hrResult = $conn->query("SELECT id FROM employees WHERE is_admin = 1 AND is_active = 1");
        while ($hr = $hrResult->fetch_assoc()) {
            create_notification($conn, $hr['id'],
                'คำขอรออนุมัติ',
                ($emp['name'] ?? $employee_id) . " ส่งคำขอ{$requestType} (ไม่มีผู้อนุมัติขั้น 1)",
                'pending_actions',
                'bg-amber-100 dark:bg-amber-900/30',
                'leave',
                'text-amber-600'
            );
            safe_send_push($conn, $hr['id'], 'คำขอรออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอ{$requestType} (ไม่มีผู้อนุมัติขั้น 1)");
        }
    }

    json_response(['id' => $newId, 'message' => 'Created'], 201);
}

// ─── PUT (Approve / Reject) ───
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $body = get_json_body();
    $action = $body['status']; // 'approved' or 'rejected'
    $actorId = $body['approved_by'] ?? null;

    // Fetch current request state
    $reqStmt = $conn->prepare("SELECT lr.*, CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS employee_name, e.approver_id, e.approver2_id FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.id = ?");
    $reqStmt->bind_param('i', $id);
    $reqStmt->execute();
    $req = $reqStmt->get_result()->fetch_assoc();

    if (!$req) {
        json_response(['error' => 'Request not found'], 404);
    }

    // Check if actor is HR/admin/superadmin
    $actorStmt = $conn->prepare("SELECT is_admin, is_superadmin, name FROM employees WHERE id = ?");
    $actorStmt->bind_param('s', $actorId);
    $actorStmt->execute();
    $actor = $actorStmt->get_result()->fetch_assoc();
    $isHR = $actor && $actor['is_admin'];
    $isSuperAdmin = $actor && $actor['is_superadmin'];
    $isSelfRequest = ($actorId === $req['employee_id']); // Prevent self-approval
    $actorName = $actor['name'] ?? $actorId;

    // Determine which tier this actor operates on
    $tier1Approver = $req['expected_approver1_id'];
    $tier2Approver = $req['expected_approver2_id'];

    // === REJECT: Any tier can reject and it finalizes the request ===
    if ($action === 'rejected') {
        // Block self-rejection
        if ($isSelfRequest) {
            json_response(['error' => 'ไม่สามารถปฏิเสธคำขอของตัวเองได้'], 403);
        }
        if ($actorId === $tier1Approver && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE leave_requests SET 
                tier1_status='rejected', tier1_by='$actorId', tier1_at=NOW(),
                status='rejected', approved_by='$actorId', approved_at=NOW()
                WHERE id=$id");
        } elseif ($actorId === $tier2Approver && $req['tier1_status'] === 'approved') {
            // Tier 2 rejecting (only after tier 1 approved)
            $conn->query("UPDATE leave_requests SET 
                tier2_status='rejected', tier2_by='$actorId', tier2_at=NOW(),
                status='rejected', approved_by='$actorId', approved_at=NOW()
                WHERE id=$id");
        } else {
            // Fallback
            $conn->query("UPDATE leave_requests SET status='rejected', approved_by='$actorId', approved_at=NOW() WHERE id=$id");
        }

        // Notify employee
        create_notification($conn, $req['employee_id'],
            'คำขอไม่อนุมัติ',
            "คำขอของคุณถูกปฏิเสธโดย {$actorName}",
            'cancel',
            'bg-red-100 dark:bg-red-900/30',
            'leave',
            'text-red-600'
        );
        safe_send_push($conn, $req['employee_id'], 'คำขอไม่อนุมัติ', "คำขอของคุณถูกปฏิเสธโดย {$actorName}");

        json_response(['message' => 'Rejected']);
    }

    // === APPROVE ===
    if ($action === 'approved') {
        // Block self-approval
        if ($isSelfRequest) {
            json_response(['error' => 'ไม่สามารถอนุมัติคำขอของตัวเองได้'], 403);
        }



        // --- TIER 1 APPROVAL ---
        if ($actorId === $tier1Approver && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE leave_requests SET 
                tier1_status='approved', tier1_by='$actorId', tier1_at=NOW()
                WHERE id=$id");

            // If there's a tier-2 approver, keep pending and notify them
            if ($tier2Approver) {
                create_notification($conn, $tier2Approver,
                    'คำขอรออนุมัติขั้น 2',
                    "{$req['employee_name']} ผ่านการอนุมัติขั้น 1 แล้ว รอการอนุมัติของคุณ",
                    'pending_actions',
                    'bg-amber-100 dark:bg-amber-900/30',
                    'leave',
                    'text-amber-600'
                );
                safe_send_push($conn, $tier2Approver, 'คำขอรออนุมัติขั้น 2', "{$req['employee_name']} ผ่านการอนุมัติขั้น 1 แล้ว รอการอนุมัติของคุณ");

                // Also notify employee that tier1 approved
                create_notification($conn, $req['employee_id'],
                    'อนุมัติขั้นที่ 1 แล้ว',
                    "คำขอของคุณผ่านการอนุมัติขั้นที่ 1 โดย {$actorName} รอขั้นที่ 2",
                    'task_alt',
                    'bg-blue-100 dark:bg-blue-900/30',
                    'leave',
                    'text-blue-600'
                );
                safe_send_push($conn, $req['employee_id'], 'อนุมัติขั้นที่ 1 แล้ว', "คำขอของคุณผ่านการอนุมัติขั้นที่ 1 โดย {$actorName} รอขั้นที่ 2");

                json_response(['message' => 'Tier 1 approved, pending tier 2']);
            } else {
                // No tier-2, finalize
                $conn->query("UPDATE leave_requests SET 
                    tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                    status='approved', approved_by='$actorId', approved_at=NOW()
                    WHERE id=$id");

                create_notification($conn, $req['employee_id'],
                    'คำขออนุมัติแล้ว',
                    "คำขอของคุณได้รับการอนุมัติโดย {$actorName}",
                    'check_circle',
                    'bg-green-100 dark:bg-green-900/30',
                    'leave',
                    'text-green-600'
                );
                safe_send_push($conn, $req['employee_id'], 'คำขออนุมัติแล้ว', "คำขอของคุณได้รับการอนุมัติโดย {$actorName}");

                json_response(['message' => 'Approved (no tier 2)']);
            }
        }

        // --- TIER 2 APPROVAL (after tier1 approved) ---
        if (($actorId === $tier2Approver) && $req['tier1_status'] === 'approved') {
            $conn->query("UPDATE leave_requests SET 
                tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                status='approved', approved_by='$actorId', approved_at=NOW()
                WHERE id=$id");

            create_notification($conn, $req['employee_id'],
                'คำขออนุมัติแล้ว',
                "คำขอของคุณได้รับการอนุมัติโดย {$actorName}",
                'check_circle',
                'bg-green-100 dark:bg-green-900/30',
                'leave',
                'text-green-600'
            );
            safe_send_push($conn, $req['employee_id'], 'คำขออนุมัติแล้ว', "คำขอของคุณได้รับการอนุมัติโดย {$actorName}");

            json_response(['message' => 'Approved']);
        }

        // Fallback: simple approve
        $conn->query("UPDATE leave_requests SET status='approved', approved_by='$actorId', approved_at=NOW() WHERE id=$id");
        json_response(['message' => 'Updated']);
    }

    json_response(['error' => 'Invalid action'], 400);
}

// ─── DELETE (Cancel Pending Request) ───
if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $employee_id_header = get_employee_id();
    
    if (!$employee_id_header) {
        json_response(['error' => 'Unauthorized'], 401);
    }

    // Check if the record exists and belongs to the user + is pending
    $stmt = $conn->prepare("SELECT id, status, employee_id FROM leave_requests WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $req = $stmt->get_result()->fetch_assoc();

    if (!$req) {
        json_response(['error' => 'Record not found'], 404);
    }

    if ($req['employee_id'] !== $employee_id_header) {
        json_response(['error' => 'Permission denied: Cannot delete others requests'], 403);
    }

    if ($req['status'] !== 'pending') {
        json_response(['error' => 'Cannot delete: Request is already processed'], 400);
    }

    $delStmt = $conn->prepare("DELETE FROM leave_requests WHERE id = ?");
    $delStmt->bind_param('i', $id);
    if ($delStmt->execute()) {
        json_response(['message' => 'Request deleted successfully']);
    } else {
        json_response(['error' => 'Failed to delete request'], 500);
    }
}

json_response(['error' => 'Method not allowed'], 405);
