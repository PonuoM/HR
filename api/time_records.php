<?php
/**
 * Time Records API — retroactive / off-site attendance entries (v2 — Multi-tier Approval)
 * GET    /api/time_records.php?employee_id=X          - List records for employee
 * GET    /api/time_records.php?status=pending          - Filter by status
 * GET    /api/time_records.php?approver_id=X           - Filter pending for approver
 * POST   /api/time_records.php                         - Create new time record request
 * PUT    /api/time_records.php?id=X                    - Multi-tier approve/reject
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

function safe_send_push_tr($conn, $employee_id, $title, $body) {
    global $_push_available;
    if (!$_push_available) return;
    try {
        send_push_to_employee($conn, $employee_id, $title, $body);
    } catch (Throwable $e) {
        error_log('Push send failed: ' . $e->getMessage());
    }
}

function create_notification_tr($conn, $employee_id, $title, $message, $icon = 'notifications', $icon_bg = 'bg-blue-100 dark:bg-blue-900/30', $type = 'time_record', $icon_color = 'text-blue-600') {
    $stmt = $conn->prepare("INSERT INTO notifications (employee_id, title, message, icon, icon_bg, type, icon_color) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssssss', $employee_id, $title, $message, $icon, $icon_bg, $type, $icon_color);
    $stmt->execute();
}

/**
 * Sync an approved time_record into the attendance table.
 * Uses INSERT … ON DUPLICATE KEY UPDATE so it works whether
 * the day already has an attendance row or not.
 */
function sync_to_attendance($conn, $req) {
    $emp_id   = $req['employee_id'];
    $date     = $req['record_date'];
    $clockIn  = $req['clock_in_time'];
    $clockOut = $req['clock_out_time'] ?? null;
    $locName  = $req['location_name'] ?? 'บันทึกเวลาย้อนหลัง';
    $locText  = $locName ?: 'บันทึกเวลาย้อนหลัง';

    if ($clockOut) {
        $stmt = $conn->prepare(
            "INSERT INTO attendance (employee_id, date, clock_in, clock_out, location, location_name)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE clock_in = VALUES(clock_in), clock_out = VALUES(clock_out),
                location = VALUES(location), location_name = VALUES(location_name)"
        );
        $stmt->bind_param('ssssss', $emp_id, $date, $clockIn, $clockOut, $locText, $locName);
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO attendance (employee_id, date, clock_in, location, location_name)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE clock_in = VALUES(clock_in),
                location = VALUES(location), location_name = VALUES(location_name)"
        );
        $stmt->bind_param('sssss', $emp_id, $date, $clockIn, $locText, $locName);
    }
    $stmt->execute();
}

$method = get_method();
$company_id = get_company_id();

// ─── GET ───
if ($method === 'GET') {
    $where = ['e.company_id = ?'];
    $params = [$company_id];
    $types = 'i';

    if (isset($_GET['employee_id'])) {
        $where[] = 'tr.employee_id = ?';
        $params[] = $_GET['employee_id'];
        $types .= 's';
    }
    if (isset($_GET['status'])) {
        $where[] = 'tr.status = ?';
        $params[] = $_GET['status'];
        $types .= 's';
    }
    if (isset($_GET['approver_id'])) {
        $approver_id = $_GET['approver_id'];
        $where[] = '(
            (tr.expected_approver1_id = ? AND tr.tier1_status = "pending")
            OR (tr.expected_approver2_id = ? AND tr.tier1_status IN ("approved","skipped") AND tr.tier2_status = "pending")
        )';
        $params[] = $approver_id;
        $params[] = $approver_id;
        $types .= 'ss';
        // Only show pending records for approvers
        $where[] = 'tr.status = "pending"';
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $sql = "SELECT tr.*, e.name AS employee_name, e.avatar AS employee_avatar,
                   e.approver_id, e.approver2_id,
                   d.name AS department,
                   a1.name AS approver1_name, a2.name AS approver2_name,
                   t1.name AS tier1_by_name, t2.name AS tier2_by_name,
                   wl.name AS work_location_name
            FROM time_records tr
            JOIN employees e ON tr.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN employees a1 ON tr.expected_approver1_id = a1.id
            LEFT JOIN employees a2 ON tr.expected_approver2_id = a2.id
            LEFT JOIN employees t1 ON tr.tier1_by = t1.id
            LEFT JOIN employees t2 ON tr.tier2_by = t2.id
            LEFT JOIN work_locations wl ON tr.location_id = wl.id
            $whereClause
            ORDER BY tr.created_at DESC";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    $records = [];
    while ($row = $result->fetch_assoc()) {
        $records[] = $row;
    }
    json_response($records);
}

// ─── POST (Create) ───
if ($method === 'POST') {
    $body = get_json_body();
    $employee_id = $conn->real_escape_string($body['employee_id'] ?? '');
    $record_date = $conn->real_escape_string($body['record_date'] ?? '');
    $clock_in_time = $conn->real_escape_string($body['clock_in_time'] ?? '');
    $clock_out_time = !empty($body['clock_out_time']) ? $body['clock_out_time'] : null;
    $location_id = isset($body['location_id']) ? (int)$body['location_id'] : null;
    $location_name = $conn->real_escape_string($body['location_name'] ?? '');
    $reason = $conn->real_escape_string($body['reason'] ?? '');

    if (!$employee_id || !$record_date || !$clock_in_time) {
        json_response(['error' => 'employee_id, record_date, and clock_in_time are required'], 400);
    }

    // Look up approvers from employee record
    $empStmt = $conn->prepare("SELECT e.name, e.approver_id, e.approver2_id FROM employees e WHERE e.id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $emp = $empStmt->get_result()->fetch_assoc();

    $approver1_id = $emp['approver_id'] ?? null;
    $approver2_id = $emp['approver2_id'] ?? null;

    $stmt = $conn->prepare("INSERT INTO time_records (employee_id, record_date, clock_in_time, clock_out_time, location_id, location_name, reason, expected_approver1_id, expected_approver2_id, tier1_status, tier2_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending')");
    $stmt->bind_param('sssssisss',
        $employee_id, $record_date, $clock_in_time, $clock_out_time,
        $location_id, $location_name, $reason,
        $approver1_id, $approver2_id
    );
    $stmt->execute();
    $newId = $conn->insert_id;

    // Notify tier-1 approver
    if ($approver1_id) {
        create_notification_tr($conn, $approver1_id,
            'คำขอบันทึกเวลารออนุมัติ',
            ($emp['name'] ?? $employee_id) . " ส่งคำขอบันทึกเวลา รอการอนุมัติของคุณ",
            'pending_actions',
            'bg-amber-100 dark:bg-amber-900/30',
            'time_record',
            'text-amber-600'
        );
        safe_send_push_tr($conn, $approver1_id, 'คำขอบันทึกเวลารออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอบันทึกเวลา รอการอนุมัติของคุณ");
    } else {
        // No specific approver — notify all HR admins
        $hrResult = $conn->query("SELECT id FROM employees WHERE is_admin = 1 AND is_active = 1 AND company_id = $company_id");
        while ($hr = $hrResult->fetch_assoc()) {
            create_notification_tr($conn, $hr['id'],
                'คำขอบันทึกเวลารออนุมัติ',
                ($emp['name'] ?? $employee_id) . " ส่งคำขอบันทึกเวลา (ไม่มีผู้อนุมัติขั้น 1)",
                'pending_actions',
                'bg-amber-100 dark:bg-amber-900/30',
                'time_record',
                'text-amber-600'
            );
            safe_send_push_tr($conn, $hr['id'], 'คำขอบันทึกเวลารออนุมัติ', ($emp['name'] ?? $employee_id) . " ส่งคำขอบันทึกเวลา (ไม่มีผู้อนุมัติขั้น 1)");
        }
    }

    json_response(['id' => $newId, 'message' => 'Time record created'], 201);
}

// ─── PUT (Approve / Reject) ───
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $body = get_json_body();
    $action = $body['status']; // 'approved' or 'rejected'
    $actorId = $body['approved_by'] ?? null;
    $isBypass = isset($body['is_bypass']) ? (int)$body['is_bypass'] : 0;

    // Fetch current record
    $reqStmt = $conn->prepare("SELECT tr.*, e.name AS employee_name, e.approver_id, e.approver2_id FROM time_records tr JOIN employees e ON tr.employee_id = e.id WHERE tr.id = ?");
    $reqStmt->bind_param('i', $id);
    $reqStmt->execute();
    $req = $reqStmt->get_result()->fetch_assoc();

    if (!$req) {
        json_response(['error' => 'Record not found'], 404);
    }

    // Check if actor is HR/admin
    $actorStmt = $conn->prepare("SELECT is_admin, name FROM employees WHERE id = ?");
    $actorStmt->bind_param('s', $actorId);
    $actorStmt->execute();
    $actor = $actorStmt->get_result()->fetch_assoc();
    $isHR = $actor && $actor['is_admin'];
    $isSelfRequest = ($actorId === $req['employee_id']); // Prevent self-approval
    $actorName = $actor['name'] ?? $actorId;

    $tier1Approver = $req['expected_approver1_id'];
    $tier2Approver = $req['expected_approver2_id'];

    // === REJECT ===
    if ($action === 'rejected') {
        // Block self-rejection
        if ($isSelfRequest) {
            json_response(['error' => 'ไม่สามารถปฏิเสธคำขอของตัวเองได้'], 403);
        }
        if ($actorId === $tier1Approver && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE time_records SET 
                tier1_status='rejected', tier1_by='$actorId', tier1_at=NOW(),
                status='rejected', approved_by='$actorId', approved_at=NOW()
                WHERE id=$id");
        } elseif ($isHR || $actorId === $tier2Approver) {
            $tier1Update = ($req['tier1_status'] === 'pending' && $isBypass) ? "tier1_status='skipped'," : '';
            $conn->query("UPDATE time_records SET 
                $tier1Update
                tier2_status='rejected', tier2_by='$actorId', tier2_at=NOW(),
                status='rejected', approved_by='$actorId', approved_at=NOW(),
                is_bypass=$isBypass
                WHERE id=$id");
        } else {
            $conn->query("UPDATE time_records SET status='rejected', approved_by='$actorId', approved_at=NOW() WHERE id=$id");
        }

        create_notification_tr($conn, $req['employee_id'],
            'บันทึกเวลาไม่อนุมัติ',
            "คำขอบันทึกเวลาของคุณถูกปฏิเสธโดย {$actorName}",
            'cancel', 'bg-red-100 dark:bg-red-900/30', 'time_record', 'text-red-600'
        );
        safe_send_push_tr($conn, $req['employee_id'], 'บันทึกเวลาไม่อนุมัติ', "คำขอบันทึกเวลาของคุณถูกปฏิเสธโดย {$actorName}");

        json_response(['message' => 'Rejected']);
    }

    // === APPROVE ===
    if ($action === 'approved') {
        // Block self-approval
        if ($isSelfRequest) {
            json_response(['error' => 'ไม่สามารถอนุมัติคำขอของตัวเองได้'], 403);
        }

        // HR BYPASS
        if ($isBypass && $isHR && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE time_records SET 
                tier1_status='skipped', 
                tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                status='approved', approved_by='$actorId', approved_at=NOW(),
                is_bypass=1
                WHERE id=$id");

            create_notification_tr($conn, $req['employee_id'],
                'บันทึกเวลาอนุมัติแล้ว (Bypass)',
                "คำขอบันทึกเวลาของคุณได้รับการอนุมัติโดย {$actorName} (ข้ามขั้นตอนที่ 1)",
                'verified', 'bg-green-100 dark:bg-green-900/30', 'time_record', 'text-green-600'
            );
            safe_send_push_tr($conn, $req['employee_id'], 'บันทึกเวลาอนุมัติแล้ว', "คำขอบันทึกเวลาอนุมัติโดย {$actorName} (Bypass)");

            sync_to_attendance($conn, $req);
            json_response(['message' => 'Approved (bypass)']);
        }

        // TIER 1 APPROVAL
        if ($actorId === $tier1Approver && $req['tier1_status'] === 'pending') {
            $conn->query("UPDATE time_records SET 
                tier1_status='approved', tier1_by='$actorId', tier1_at=NOW()
                WHERE id=$id");

            if ($tier2Approver) {
                create_notification_tr($conn, $tier2Approver,
                    'บันทึกเวลารออนุมัติขั้น 2',
                    "{$req['employee_name']} ผ่านการอนุมัติขั้น 1 แล้ว รอการอนุมัติของคุณ",
                    'pending_actions', 'bg-amber-100 dark:bg-amber-900/30', 'time_record', 'text-amber-600'
                );
                safe_send_push_tr($conn, $tier2Approver, 'บันทึกเวลารออนุมัติขั้น 2', "{$req['employee_name']} ผ่านการอนุมัติขั้น 1 แล้ว รอการอนุมัติของคุณ");

                create_notification_tr($conn, $req['employee_id'],
                    'อนุมัติขั้นที่ 1 แล้ว',
                    "คำขอบันทึกเวลาผ่านการอนุมัติขั้นที่ 1 โดย {$actorName} รอขั้นที่ 2",
                    'task_alt', 'bg-blue-100 dark:bg-blue-900/30', 'time_record', 'text-blue-600'
                );
                safe_send_push_tr($conn, $req['employee_id'], 'อนุมัติขั้นที่ 1 แล้ว', "คำขอบันทึกเวลาผ่านขั้น 1 โดย {$actorName} รอขั้นที่ 2");

                json_response(['message' => 'Tier 1 approved, pending tier 2']);
            } else {
                // No tier-2, finalize
                $conn->query("UPDATE time_records SET 
                    tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                    status='approved', approved_by='$actorId', approved_at=NOW()
                    WHERE id=$id");

                create_notification_tr($conn, $req['employee_id'],
                    'บันทึกเวลาอนุมัติแล้ว',
                    "คำขอบันทึกเวลาของคุณได้รับการอนุมัติโดย {$actorName}",
                    'check_circle', 'bg-green-100 dark:bg-green-900/30', 'time_record', 'text-green-600'
                );
                safe_send_push_tr($conn, $req['employee_id'], 'บันทึกเวลาอนุมัติแล้ว', "คำขอบันทึกเวลาอนุมัติโดย {$actorName}");

                sync_to_attendance($conn, $req);
                json_response(['message' => 'Approved (no tier 2)']);
            }
        }

        // TIER 2 APPROVAL (or HR after tier1 approved)
        if (($actorId === $tier2Approver || $isHR) && ($req['tier1_status'] === 'approved' || $req['tier1_status'] === 'skipped')) {
            $conn->query("UPDATE time_records SET 
                tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                status='approved', approved_by='$actorId', approved_at=NOW()
                WHERE id=$id");

            create_notification_tr($conn, $req['employee_id'],
                'บันทึกเวลาอนุมัติแล้ว',
                "คำขอบันทึกเวลาของคุณได้รับการอนุมัติโดย {$actorName}",
                'check_circle', 'bg-green-100 dark:bg-green-900/30', 'time_record', 'text-green-600'
            );
            safe_send_push_tr($conn, $req['employee_id'], 'บันทึกเวลาอนุมัติแล้ว', "คำขอบันทึกเวลาอนุมัติโดย {$actorName}");

            sync_to_attendance($conn, $req);
            json_response(['message' => 'Approved']);
        }

        // HR approving directly
        if ($isHR) {
            $bypassVal = ($req['tier1_status'] === 'pending' && $tier1Approver) ? 1 : 0;
            $tier1Upd = ($req['tier1_status'] === 'pending') ? "tier1_status='skipped'," : '';
            $conn->query("UPDATE time_records SET 
                $tier1Upd
                tier2_status='approved', tier2_by='$actorId', tier2_at=NOW(),
                status='approved', approved_by='$actorId', approved_at=NOW(),
                is_bypass=$bypassVal
                WHERE id=$id");

            $bypassLabel = $bypassVal ? ' (ข้ามขั้นตอนที่ 1)' : '';
            create_notification_tr($conn, $req['employee_id'],
                'บันทึกเวลาอนุมัติแล้ว',
                "คำขอบันทึกเวลาของคุณได้รับการอนุมัติโดย {$actorName}{$bypassLabel}",
                'check_circle', 'bg-green-100 dark:bg-green-900/30', 'time_record', 'text-green-600'
            );
            safe_send_push_tr($conn, $req['employee_id'], 'บันทึกเวลาอนุมัติแล้ว', "คำขอบันทึกเวลาอนุมัติโดย {$actorName}{$bypassLabel}");

            sync_to_attendance($conn, $req);
            json_response(['message' => 'Approved by HR']);
        }

        // Fallback
        $conn->query("UPDATE time_records SET status='approved', approved_by='$actorId', approved_at=NOW() WHERE id=$id");
        json_response(['message' => 'Updated']);
    }

    json_response(['error' => 'Invalid action'], 400);
}

json_response(['error' => 'Method not allowed'], 405);
