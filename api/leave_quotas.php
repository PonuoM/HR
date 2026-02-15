<?php
/**
 * Leave Quotas API
 * GET /api/leave_quotas.php?employee_id=X&year=Y  - Get quotas for employee
 * PUT /api/leave_quotas.php                        - Update/set quota (admin)
 *
 * "used" is ALWAYS auto-calculated from approved leave_requests, never stored manually.
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    $employee_id = $conn->real_escape_string($_GET['employee_id'] ?? 'EMP001');
    $year = (int)($_GET['year'] ?? date('Y'));

    // Auto-provision: if no quotas for this employee+year, create defaults
    $check = $conn->query("SELECT COUNT(*) as cnt FROM leave_quotas WHERE employee_id = '$employee_id' AND year = $year");
    $row = $check->fetch_assoc();
    if ((int)$row['cnt'] === 0) {
        $defaults = [
            1 => 6,   // ลาพักร้อน
            2 => 30,  // ลาป่วย
            3 => 3,   // ลากิจ
            4 => 15,  // ลาทำหมัน
            5 => 0,   // ลาไม่รับค่าจ้าง
        ];
        $stmt = $conn->prepare("INSERT IGNORE INTO leave_quotas (employee_id, leave_type_id, total, used, year) VALUES (?, ?, ?, 0, ?)");
        foreach ($defaults as $lt_id => $total) {
            $stmt->bind_param('siis', $employee_id, $lt_id, $total, $year);
            $stmt->execute();
        }
    }

    // Query quotas with auto-calculated "used" from approved leave_requests
    $sql = "SELECT lq.id, lq.employee_id, lq.leave_type_id, lq.total, lq.year,
                   lt.name AS leave_type_name, lt.type AS leave_category, lt.color, lt.icon, lt.icon_url, lt.unit,
                   COALESCE(used_calc.total_used, 0) AS used
            FROM leave_quotas lq
            JOIN leave_types lt ON lq.leave_type_id = lt.id
            LEFT JOIN (
                SELECT employee_id, leave_type_id, 
                       SUM(total_days) AS total_used
                FROM leave_requests
                WHERE status IN ('approved', 'pending')
                  AND YEAR(start_date) = $year
                GROUP BY employee_id, leave_type_id
            ) used_calc ON used_calc.employee_id = lq.employee_id 
                       AND used_calc.leave_type_id = lq.leave_type_id
            WHERE lq.employee_id = '$employee_id' AND lq.year = $year
            ORDER BY lt.id";
    $result = $conn->query($sql);
    $quotas = [];
    while ($row = $result->fetch_assoc()) {
        $row['used'] = (int)$row['used'];
        $row['total'] = (int)$row['total'];
        $row['remaining'] = $row['total'] - $row['used'];
        // For "unlimited" types (total=0), remaining is always unlimited
        if ($row['total'] === 0) {
            $row['remaining'] = -1; // -1 means unlimited
        }
        $quotas[] = $row;
    }
    json_response($quotas);
}

if ($method === 'PUT') {
    $body = get_json_body();
    $employee_id = $conn->real_escape_string($body['employee_id']);
    $leave_type_id = (int)$body['leave_type_id'];
    $total = (int)$body['total'];
    $year = (int)($body['year'] ?? date('Y'));

    $sql = "INSERT INTO leave_quotas (employee_id, leave_type_id, total, year) VALUES ('$employee_id', $leave_type_id, $total, $year)
            ON DUPLICATE KEY UPDATE total = $total";
    $conn->query($sql);
    json_response(['message' => 'Quota updated']);
}

json_response(['error' => 'Method not allowed'], 405);
