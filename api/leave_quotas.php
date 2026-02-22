<?php
/**
 * Leave Quotas API
 * GET /api/leave_quotas.php?employee_id=X&year=Y  - Get quotas for employee
 * PUT /api/leave_quotas.php                        - Update/set quota (admin)
 *
 * "used" is ALWAYS auto-calculated from approved leave_requests, never stored manually.
 * Seniority tiers: quotas are automatically upgraded based on employee's years of service.
 */
require_once __DIR__ . '/config.php';

$method = get_method();

/**
 * Helper: Calculate the correct quota for an employee + leave type,
 * considering seniority tiers and employee's years of service.
 */
function get_tier_quota($conn, $employee_id, $leave_type_id, $default_quota, $company_id) {
    // Get employee's hire_date
    $empStmt = $conn->prepare("SELECT hire_date FROM employees WHERE id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $empRow = $empStmt->get_result()->fetch_assoc();

    if (!$empRow || empty($empRow['hire_date'])) {
        return (int)$default_quota;
    }

    $startDate = new DateTime($empRow['hire_date']);
    $now = new DateTime();
    $yearsOfService = (int)$startDate->diff($now)->y;

    // Find matching seniority tier (highest min_years that the employee qualifies for)
    $tierStmt = $conn->prepare(
        "SELECT days FROM leave_seniority_tiers 
         WHERE company_id = ? AND leave_type_id = ? AND min_years <= ? 
         ORDER BY min_years DESC LIMIT 1"
    );
    $tierStmt->bind_param('iii', $company_id, $leave_type_id, $yearsOfService);
    $tierStmt->execute();
    $tierRow = $tierStmt->get_result()->fetch_assoc();

    if ($tierRow) {
        return (int)$tierRow['days'];
    }

    return (int)$default_quota;
}

if ($method === 'GET') {
    $employee_id = $conn->real_escape_string($_GET['employee_id'] ?? 'EMP001');
    $year = (int)($_GET['year'] ?? date('Y'));

    // Get employee's company_id
    $empStmt = $conn->prepare("SELECT company_id FROM employees WHERE id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $empRow = $empStmt->get_result()->fetch_assoc();
    $emp_company_id = $empRow ? (int)$empRow['company_id'] : 1;

    // Auto-provision: if no quotas for this employee+year, create defaults with seniority tier
    $check = $conn->query("SELECT COUNT(*) as cnt FROM leave_quotas WHERE employee_id = '$employee_id' AND year = $year");
    $row = $check->fetch_assoc();
    if ((int)$row['cnt'] === 0) {
        // Fetch leave types for that company
        $ltStmt = $conn->prepare("SELECT id, default_quota FROM leave_types WHERE company_id = ? AND is_active = 1 ORDER BY id");
        $ltStmt->bind_param('i', $emp_company_id);
        $ltStmt->execute();
        $ltResult = $ltStmt->get_result();

        $stmt = $conn->prepare("INSERT IGNORE INTO leave_quotas (employee_id, leave_type_id, total, used, year) VALUES (?, ?, ?, 0, ?)");
        while ($lt = $ltResult->fetch_assoc()) {
            $lt_id = (int)$lt['id'];
            // Use seniority tier quota instead of default
            $lt_total = get_tier_quota($conn, $employee_id, $lt_id, $lt['default_quota'], $emp_company_id);
            $stmt->bind_param('siis', $employee_id, $lt_id, $lt_total, $year);
            $stmt->execute();
        }
    } else {
        // ── Auto-upgrade existing quotas based on seniority tiers ──
        // For each existing quota, check if the employee now qualifies for a higher tier
        $existingStmt = $conn->prepare(
            "SELECT lq.id, lq.leave_type_id, lq.total, lt.default_quota 
             FROM leave_quotas lq 
             JOIN leave_types lt ON lq.leave_type_id = lt.id 
             WHERE lq.employee_id = ? AND lq.year = ?"
        );
        $existingStmt->bind_param('si', $employee_id, $year);
        $existingStmt->execute();
        $existingResult = $existingStmt->get_result();

        $updateStmt = $conn->prepare("UPDATE leave_quotas SET total = ? WHERE id = ?");
        while ($eq = $existingResult->fetch_assoc()) {
            $correctQuota = get_tier_quota($conn, $employee_id, (int)$eq['leave_type_id'], $eq['default_quota'], $emp_company_id);
            // Only upgrade, never downgrade (admin may have set a custom higher value)
            if ($correctQuota > (int)$eq['total']) {
                $eqId = (int)$eq['id'];
                $updateStmt->bind_param('ii', $correctQuota, $eqId);
                $updateStmt->execute();
            }
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
