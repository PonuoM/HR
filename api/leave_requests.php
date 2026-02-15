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
require_once __DIR__ . '/send_push.php';

$method = get_method();

// ─── Helper: insert notification ───
function create_notification($conn, $employee_id, $title, $message, $icon = 'notifications', $icon_bg = 'bg-blue-100 dark:bg-blue-900/30', $type = 'leave', $icon_color = 'text-blue-600') {
    $stmt = $conn->prepare("INSERT INTO notifications (employee_id, title, message, icon, icon_bg, type, icon_color) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssssss', $employee_id, $title, $message, $icon, $icon_bg, $type, $icon_color);
    $stmt->execute();
}

// ─── GET ───
if ($method === 'GET') {
    $where = [];
    $params = [];
    $types = '';

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

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "SELECT lr.*, e.name AS employee_name, e.avatar AS employee_avatar,
                   e.approver_id, e.approver2_id,
                   lt.name AS leave_type_name, lt.color AS leave_type_color,
                   d.name AS department,
                   a1.name AS approver1_name, a1.avatar AS approver1_avatar,
                   a2.name AS approver2_name, a2.avatar AS approver2_avatar,
                   t1.name AS tier1_by_name, t2.name AS tier2_by_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
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
    $body = get_json_body();
    $employee_id = $body['employee_id'];

    // Look up approvers from employee record
    $empStmt = $conn->prepare("SELECT e.name, e.approver_id, e.approver2_id, a1.name AS approver1_name FROM employees e LEFT JOIN employees a1 ON e.approver_id = a1.id WHERE e.id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $emp = $empStmt->get_result()->fetch_assoc();

    $approver1_id = $emp['approver_id'] ?? null;
    $approver2_id = $emp['approver2_id'] ?? null;

    $stmt = $conn->prepare("INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason, expected_approver1_id, expected_approver2_id, tier1_status, tier2_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')");
    $stmt->bind_param('sissssss',
        $body['employee_id'], $body['leave_type_id'],
        $body['start_date'], $body['end_date'],
        $body['total_days'], $body['reason'],
        $approver1_id, $approver2_id
    );
    $stmt->execute();
    $newId = $conn->insert_id;

    // Look up leave type name for notification
    $ltStmt = $conn->prepare("SELECT name FROM leave_types WHERE id = ?");
    $ltStmt->bind_param('i', $body['leave_type_id']);
    $ltStmt->execute();
    $lt = $ltStmt->get_result()->fetch_assoc();
    $leaveTypeName = $lt['name'] ?? 'ลา';

    $isOT = isset($body['reason']) && strpos($body['reason'], '[OT]') === 0;
    $requestType = $isOT ? 'ขอ OT' : $leaveTypeName;

    // Notify tier-1 approver (or all HR if no approver set)
    if ($approver1_id) {
        create_notification($conn, $approver1_id,
            'คำขอรออนุมัติ',
            ($emp['name'] ?? $employee_id) . " ส่งคำขอ{$requestType} รอการอนุมัติของคุณ",
            'pending_actions',
            'bg-amber-100 dark:bg-amber-900/30',
            'leave',
            'text-amber-600'
        );
        send_push_to_employee($conn, $approver1_id, 'คำขอรออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอ{$requestType} รอการอนุมัติของคุณ");
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
            send_push_to_employee($conn, $hr['id'], 'คำขอรออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอ{$requestType} (ไม่มีผู้อนุมัติขั้น 1)");
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
    $isBypass = isset($body['is_bypass']) ? (int)$body['is_bypass'] : 0;

    // Fetch current request state
    $reqStmt = $conn->prepare("SELECT lr.*, e.name AS employee_name, e.approver_id, e.approver2_id FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.id = ?");
    $reqStmt->bind_param('i', $id);
    $reqStmt->execute();
    $req = $reqStmt->get_result()->fetch_assoc();

    if (!$req) {
        json_response(['error' => 'Request not found'], 404);
    }

    // Check if actor is HR/admin
    $actorStmt = $conn->prepare("SELECT is_admin, name FROM employees WHERE id = ?");
    $actorStmt->bind_param('s', $actorId);
    $actorStmt->execute();
    $actor = $actorStmt->get_result()->fetch_assoc();
    $isHR = $actor && $actor['is_admin'];
    $actorName = $actor['name'] ?? $actorId;

    // Determine which tier this actor operates on
    $tier1Approver = $req['expected_approver1_id'];
    $tier2Approver = $req['expected_approver2_id'];

    // === REJECT: Any tier can reject and it finalizes the request ===
    if ($action === 'rejected') {
        if ($actorId === $tier1Approver && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE leave_requests SET 
                tier1_status='rejected', tier1_by='$actorId', tier1_at=NOW(),
                status='rejected', approved_by='$actorId', approved_at=NOW()
                WHERE id=$id");
        } elseif ($isHR || $actorId === $tier2Approver) {
            // HR or tier2 rejecting
            $tier1Update = ($req['tier1_status'] === 'pending' && $isBypass) ? "tier1_status='skipped'," : '';
            $conn->query("UPDATE leave_requests SET 
                $tier1Update
                tier2_status='rejected', tier2_by='$actorId', tier2_at=NOW(),
                status='rejected', approved_by='$actorId', approved_at=NOW(),
                is_bypass=$isBypass
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
        send_push_to_employee($conn, $req['employee_id'], 'คำขอไม่อนุมัติ', "คำขอของคุณถูกปฏิเสธโดย {$actorName}");

        json_response(['message' => 'Rejected']);
    }

    // === APPROVE ===
    if ($action === 'approved') {

        // --- HR BYPASS: HR approves while tier1 is still pending ---
        if ($isBypass && $isHR && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE leave_requests SET 
                tier1_status='skipped', 
                tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                status='approved', approved_by='$actorId', approved_at=NOW(),
                is_bypass=1
                WHERE id=$id");

            // Notify employee
            create_notification($conn, $req['employee_id'],
                'คำขออนุมัติแล้ว (Bypass)',
                "คำขอของคุณได้รับการอนุมัติโดย {$actorName} (ข้ามขั้นตอนที่ 1)",
                'verified',
                'bg-green-100 dark:bg-green-900/30',
                'leave',
                'text-green-600'
            );
            send_push_to_employee($conn, $req['employee_id'], 'คำขออนุมัติแล้ว', "คำขอของคุณได้รับการอนุมัติโดย {$actorName} (Bypass)");

            json_response(['message' => 'Approved (bypass)']);
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
                send_push_to_employee($conn, $tier2Approver, 'คำขอรออนุมัติขั้น 2', "{$req['employee_name']} ผ่านการอนุมัติขั้น 1 แล้ว รอการอนุมัติของคุณ");

                // Also notify employee that tier1 approved
                create_notification($conn, $req['employee_id'],
                    'อนุมัติขั้นที่ 1 แล้ว',
                    "คำขอของคุณผ่านการอนุมัติขั้นที่ 1 โดย {$actorName} รอขั้นที่ 2",
                    'task_alt',
                    'bg-blue-100 dark:bg-blue-900/30',
                    'leave',
                    'text-blue-600'
                );
                send_push_to_employee($conn, $req['employee_id'], 'อนุมัติขั้นที่ 1 แล้ว', "คำขอของคุณผ่านการอนุมัติขั้นที่ 1 โดย {$actorName} รอขั้นที่ 2");

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
                send_push_to_employee($conn, $req['employee_id'], 'คำขออนุมัติแล้ว', "คำขอของคุณได้รับการอนุมัติโดย {$actorName}");

                json_response(['message' => 'Approved (no tier 2)']);
            }
        }

        // --- TIER 2 APPROVAL (or HR after tier1 approved) ---
        if (($actorId === $tier2Approver || $isHR) && ($req['tier1_status'] === 'approved' || $req['tier1_status'] === 'skipped')) {
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
            send_push_to_employee($conn, $req['employee_id'], 'คำขออนุมัติแล้ว', "คำขอของคุณได้รับการอนุมัติโดย {$actorName}");

            json_response(['message' => 'Approved']);
        }

        // --- HR approving directly (no tier structure or as fallback) ---
        if ($isHR) {
            $bypassVal = ($req['tier1_status'] === 'pending' && $tier1Approver) ? 1 : 0;
            $tier1Upd = ($req['tier1_status'] === 'pending') ? "tier1_status='skipped'," : '';
            $conn->query("UPDATE leave_requests SET 
                $tier1Upd
                tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                status='approved', approved_by='$actorId', approved_at=NOW(),
                is_bypass=$bypassVal
                WHERE id=$id");

            $bypassLabel = $bypassVal ? ' (ข้ามขั้นตอนที่ 1)' : '';
            create_notification($conn, $req['employee_id'],
                'คำขออนุมัติแล้ว',
                "คำขอของคุณได้รับการอนุมัติโดย {$actorName}{$bypassLabel}",
                'check_circle',
                'bg-green-100 dark:bg-green-900/30',
                'leave',
                'text-green-600'
            );
            send_push_to_employee($conn, $req['employee_id'], 'คำขออนุมัติแล้ว', "คำขอของคุณได้รับการอนุมัติโดย {$actorName}{$bypassLabel}");

            json_response(['message' => 'Approved by HR']);
        }

        // Fallback: simple approve
        $conn->query("UPDATE leave_requests SET status='approved', approved_by='$actorId', approved_at=NOW() WHERE id=$id");
        json_response(['message' => 'Updated']);
    }

    json_response(['error' => 'Invalid action'], 400);
}

json_response(['error' => 'Method not allowed'], 405);
