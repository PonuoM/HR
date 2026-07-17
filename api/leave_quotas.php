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
function get_tier_quota($conn, $employee_id, $leave_type_id, $default_quota, $company_id, $quota_year = null) {
    if (!$quota_year) {
        $quota_year = (int)date('Y');
    }

    // Get employee's hire_date
    $empStmt = $conn->prepare("SELECT hire_date FROM employees WHERE id = ?");
    $empStmt->bind_param('s', $employee_id);
    $empStmt->execute();
    $empRow = $empStmt->get_result()->fetch_assoc();

    // Look up leave type category and settings
    $ltInfoStmt = $conn->prepare("SELECT type, prorate_first_year, probation_months FROM leave_types WHERE id = ?");
    $ltInfoStmt->bind_param('i', $leave_type_id);
    $ltInfoStmt->execute();
    $ltInfoRow = $ltInfoStmt->get_result()->fetch_assoc();
    $leave_category = $ltInfoRow ? $ltInfoRow['type'] : 'annual';
    $prorate_first_year = $ltInfoRow ? (int)$ltInfoRow['prorate_first_year'] : 0;
    $probation_months = $ltInfoRow ? (int)$ltInfoRow['probation_months'] : 4;

    if ($leave_category !== 'seniority') {
        return (int)$default_quota;
    }

    if (!$empRow || empty($empRow['hire_date'])) {
        return 0;
    }

    $startDate = new DateTime($empRow['hire_date']);
    $hireYear = (int)$startDate->format('Y');

    // Flat annual entitlement for a given completed-years count, from the tier table.
    $tierDaysFor = function (int $years) use ($conn, $company_id, $leave_type_id): ?float {
        if ($years < 1) return null;
        $stmt = $conn->prepare(
            "SELECT days FROM leave_seniority_tiers
             WHERE company_id = ? AND leave_type_id = ? AND min_years <= ?
             ORDER BY min_years DESC LIMIT 1"
        );
        $stmt->bind_param('iii', $company_id, $leave_type_id, $years);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? (float)$row['days'] : null;
    };

    // Monthly-equivalent entitlement earned for months [1..$uptoMonth] of $quota_year,
    // for an employee still under 1 year of service throughout — i.e. zero before probation
    // clears, then $default_quota/12 per month once it has.
    $preTierValue = function (int $uptoMonth) use ($startDate, $quota_year, $default_quota, $probation_months): float {
        if ($uptoMonth <= 0) return 0.0;
        $probationEnd = (clone $startDate)->modify("+{$probation_months} months");
        $peYear = (int)$probationEnd->format('Y');
        $peMonth = (int)$probationEnd->format('n');
        if ($peYear < $quota_year) {
            return ($default_quota / 12) * $uptoMonth; // already cleared before this year began
        }
        if ($peYear > $quota_year) {
            return 0.0; // won't clear probation within this year at all
        }
        $activeMonths = max(0, $uptoMonth - $peMonth);
        return ($default_quota / 12) * $activeMonths;
    };

    if ($quota_year === $hireYear) {
        // Hire year itself: prorate by months already worked so far this year.
        if ($prorate_first_year !== 1) return 0;
        $now = new DateTime();
        $diff = $startDate->diff($now);
        $monthsOfService = ((int)$diff->y * 12) + (int)$diff->m;
        if ($monthsOfService < $probation_months) return 0;
        return round(($monthsOfService / 12) * $default_quota * 2) / 2; // nearest 0.5 day
    }

    if ($quota_year < $hireYear) {
        return 0;
    }

    // quota_year > hireYear: determine years-of-service as of the start and end of quota_year.
    // This is deterministic per (employee, quota_year) — NOT dependent on "today" — so the
    // result is stable no matter when during the year the API happens to be called.
    $jan1 = new DateTime("{$quota_year}-01-01");
    $dec31 = new DateTime("{$quota_year}-12-31");
    $yearsAtJan1 = (int)$startDate->diff($jan1)->y;
    $yearsAtDec31 = (int)$startDate->diff($dec31)->y;
    $anniversaryMonth = (int)$startDate->format('n');

    if ($prorate_first_year !== 1) {
        return $tierDaysFor($yearsAtDec31) ?? 0;
    }

    if ($yearsAtJan1 === $yearsAtDec31) {
        // No seniority-tier crossing within this calendar year.
        if ($yearsAtJan1 >= 1) {
            return $tierDaysFor($yearsAtJan1) ?? (float)$default_quota;
        }
        return $preTierValue(12); // still under 1 year of service for the whole year
    }

    // Exactly one tier crossing this year, at the employee's hire-month anniversary —
    // blend the pre-anniversary rate with the post-anniversary rate by month, rather than
    // jumping to the new tier's full annual amount for the whole year.
    $oldPortion = $yearsAtJan1 >= 1
        ? (($tierDaysFor($yearsAtJan1) ?? (float)$default_quota) / 12) * $anniversaryMonth
        : $preTierValue($anniversaryMonth);
    $newAnnual = $tierDaysFor($yearsAtDec31) ?? (float)$default_quota;
    $newPortion = ($newAnnual / 12) * (12 - $anniversaryMonth);

    return round(($oldPortion + $newPortion) * 2) / 2;
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'summary') {
    // ── Company-wide overview: all active employees + their quotas (read-only, no auto-provision) ──
    $year = (int)($_GET['year'] ?? date('Y'));
    $company_id = get_company_id();

    // Optional superadmin: cross-company view
    $caller_id = get_employee_id();
    $is_super = is_admin_user($conn, $caller_id);
    $cross_company = !empty($_GET['all_companies']) && $is_super;

    // Active leave types for this company (or all if cross-company)
    if ($cross_company) {
        $ltSql = "SELECT id, name, color, icon, type, default_quota FROM leave_types WHERE is_active = 1 ORDER BY id";
        $ltRes = $conn->query($ltSql);
    } else {
        $ltStmt = $conn->prepare("SELECT id, name, color, icon, type, default_quota FROM leave_types WHERE company_id = ? AND is_active = 1 ORDER BY id");
        $ltStmt->bind_param('i', $company_id);
        $ltStmt->execute();
        $ltRes = $ltStmt->get_result();
    }
    $leaveTypes = [];
    while ($row = $ltRes->fetch_assoc()) $leaveTypes[] = $row;

    // All active employees (in company)
    if ($cross_company) {
        $empSql = "SELECT e.id, e.name, e.nickname, e.hire_date, e.company_id,
                          d.name AS department, c.name AS company_name
                   FROM employees e
                   LEFT JOIN departments d ON e.department_id = d.id
                   LEFT JOIN companies c ON e.company_id = c.id
                   WHERE e.is_active = 1
                   ORDER BY e.company_id, e.id";
        $empRes = $conn->query($empSql);
    } else {
        $empStmt = $conn->prepare("SELECT e.id, e.name, e.nickname, e.hire_date,
                                          d.name AS department
                                   FROM employees e
                                   LEFT JOIN departments d ON e.department_id = d.id
                                   WHERE e.is_active = 1 AND e.company_id = ?
                                   ORDER BY e.id");
        $empStmt->bind_param('i', $company_id);
        $empStmt->execute();
        $empRes = $empStmt->get_result();
    }
    $employees = [];
    while ($row = $empRes->fetch_assoc()) $employees[] = $row;

    // Bulk fetch ALL quotas for the year (one query)
    $quotaMap = []; // [employee_id][leave_type_id] => total
    if ($cross_company) {
        $qRes = $conn->query("SELECT employee_id, leave_type_id, total FROM leave_quotas WHERE year = $year");
    } else {
        $qStmt = $conn->prepare("SELECT lq.employee_id, lq.leave_type_id, lq.total FROM leave_quotas lq JOIN employees e ON lq.employee_id = e.id WHERE lq.year = ? AND e.company_id = ?");
        $qStmt->bind_param('ii', $year, $company_id);
        $qStmt->execute();
        $qRes = $qStmt->get_result();
    }
    while ($row = $qRes->fetch_assoc()) {
        $quotaMap[$row['employee_id']][(int)$row['leave_type_id']] = (float)$row['total'];
    }

    // Bulk fetch ALL used (approved + pending) for the year
    $usedMap = []; // [employee_id][leave_type_id] => used
    if ($cross_company) {
        $uRes = $conn->query("SELECT employee_id, leave_type_id, SUM(total_days) AS used
                              FROM leave_requests
                              WHERE status IN ('approved','pending') AND YEAR(start_date) = $year
                              GROUP BY employee_id, leave_type_id");
    } else {
        $uStmt = $conn->prepare("SELECT lr.employee_id, lr.leave_type_id, SUM(lr.total_days) AS used
                                 FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id
                                 WHERE lr.status IN ('approved','pending') AND YEAR(lr.start_date) = ? AND e.company_id = ?
                                 GROUP BY lr.employee_id, lr.leave_type_id");
        $uStmt->bind_param('ii', $year, $company_id);
        $uStmt->execute();
        $uRes = $uStmt->get_result();
    }
    while ($row = $uRes->fetch_assoc()) {
        $usedMap[$row['employee_id']][(int)$row['leave_type_id']] = (float)$row['used'];
    }

    // Compose response: per-employee quota matrix
    $rows = [];
    foreach ($employees as $emp) {
        $eid = $emp['id'];
        $perType = [];
        foreach ($leaveTypes as $lt) {
            $ltId = (int)$lt['id'];
            $total = $quotaMap[$eid][$ltId] ?? null;
            $used  = $usedMap[$eid][$ltId] ?? 0;
            // remaining: -1 = unlimited (only for unpaid leave_type with total=0)
            $remaining = null;
            if ($total !== null) {
                if ($total == 0 && $lt['type'] === 'unpaid') $remaining = -1;
                else $remaining = round($total - $used, 2); // round to kill float precision noise
            }
            $perType[] = [
                'leave_type_id'   => $ltId,
                'leave_type_name' => $lt['name'],
                'color'           => $lt['color'],
                'icon'            => $lt['icon'],
                'category'        => $lt['type'],
                'total'           => $total !== null ? round($total, 2) : null,
                'used'            => round($used, 2),
                'remaining'       => $remaining,
            ];
        }
        $rows[] = [
            'employee_id' => $eid,
            'name'        => $emp['name'],
            'nickname'    => $emp['nickname'],
            'department'  => $emp['department'] ?? '-',
            'hire_date'   => $emp['hire_date'],
            'company_id'  => $emp['company_id'] ?? null,
            'company_name'=> $emp['company_name'] ?? null,
            'quotas'      => $perType,
        ];
    }

    json_response([
        'year' => $year,
        'leave_types' => $leaveTypes,
        'employees' => $rows,
    ]);
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

    // Clean up any cross-company quota rows (wrong company leave types)
    $cleanupStmt = $conn->prepare(
        "DELETE lq FROM leave_quotas lq
         JOIN leave_types lt ON lq.leave_type_id = lt.id
         WHERE lq.employee_id = ? AND lq.year = ? AND lt.company_id != ?"
    );
    $cleanupStmt->bind_param('sii', $employee_id, $year, $emp_company_id);
    $cleanupStmt->execute();

    // Auto-provision: create missing quota rows per leave type (not just count-based)
    $ltStmt = $conn->prepare("SELECT id, default_quota FROM leave_types WHERE company_id = ? AND is_active = 1 ORDER BY id");
    $ltStmt->bind_param('i', $emp_company_id);
    $ltStmt->execute();
    $ltResult = $ltStmt->get_result();

    $insertStmt = $conn->prepare("INSERT IGNORE INTO leave_quotas (employee_id, leave_type_id, total, used, year) VALUES (?, ?, ?, 0, ?)");
    $provisioned = false;
    while ($lt = $ltResult->fetch_assoc()) {
        $lt_id = (int)$lt['id'];
        // Check if this specific leave type quota already exists
        $existsCheck = $conn->prepare("SELECT id FROM leave_quotas WHERE employee_id = ? AND leave_type_id = ? AND year = ?");
        $existsCheck->bind_param('sii', $employee_id, $lt_id, $year);
        $existsCheck->execute();
        if ($existsCheck->get_result()->num_rows === 0) {
            $lt_total = get_tier_quota($conn, $employee_id, $lt_id, $lt['default_quota'], $emp_company_id, $year);
            $insertStmt->bind_param('sidi', $employee_id, $lt_id, $lt_total, $year);
            $insertStmt->execute();
            $provisioned = true;
        }
    }

    if (!$provisioned) {
        // ── Auto-upgrade existing quotas based on seniority tiers ──
        // For each existing quota, check if the employee now qualifies for a higher tier
        $existingStmt = $conn->prepare(
            "SELECT lq.id, lq.leave_type_id, lq.total, lt.default_quota 
             FROM leave_quotas lq 
             JOIN leave_types lt ON lq.leave_type_id = lt.id 
             WHERE lq.employee_id = ? AND lq.year = ? AND lt.company_id = ?"
        );
        $existingStmt->bind_param('sii', $employee_id, $year, $emp_company_id);
        $existingStmt->execute();
        $existingResult = $existingStmt->get_result();

        $updateStmt = $conn->prepare("UPDATE leave_quotas SET total = ? WHERE id = ?");
        while ($eq = $existingResult->fetch_assoc()) {
            $correctQuota = get_tier_quota($conn, $employee_id, (int)$eq['leave_type_id'], $eq['default_quota'], $emp_company_id, $year);
            // Only upgrade, never downgrade (admin may have set a custom higher value)
            // Exception: If current total is exactly the default_quota but they should have 0, fix the incorrect auto-provision.
            if ($correctQuota > (int)$eq['total'] || ($correctQuota === 0 && (int)$eq['total'] === (int)$eq['default_quota'])) {
                $eqId = (int)$eq['id'];
                $updateStmt->bind_param('di', $correctQuota, $eqId);
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
        $row['used'] = round((float)$row['used'], 2);
        $row['total'] = round((float)$row['total'], 2);
        $row['remaining'] = round($row['total'] - $row['used'], 2);
        // Only "unpaid" leave types are truly unlimited.
        // total=0 on seniority/annual types means "no entitlement yet"
        // (e.g. employee in probation, missing hire_date, or new hire <6 mo) — not unlimited.
        if ($row['total'] == 0 && $row['leave_category'] === 'unpaid') {
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
