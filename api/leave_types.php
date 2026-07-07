<?php
/**
 * Leave Types API (Multi-Company)
 * GET    /api/leave_types.php       - List all leave types (with seniority tiers)
 * POST   /api/leave_types.php       - Create a leave type
 * PUT    /api/leave_types.php?id=X  - Update a leave type
 * DELETE /api/leave_types.php?id=X  - Delete a leave type
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT * FROM leave_types WHERE company_id = ? ORDER BY id");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $types = [];
    while ($row = $result->fetch_assoc()) {
        $row['is_active'] = (bool)$row['is_active'];
        $row['requires_doc'] = (bool)$row['requires_doc'];
        $row['prorate_first_year'] = (bool)($row['prorate_first_year'] ?? true);
        $row['probation_months'] = (int)($row['probation_months'] ?? 0);
        $row['advance_notice_days'] = (int)($row['advance_notice_days'] ?? 0);
        $row['auto_approve'] = (bool)($row['auto_approve'] ?? false);
        $row['icon_url'] = $row['icon_url'] ?? null;
        $row['seniority_tiers'] = [];
        $types[$row['id']] = $row;
    }

    // Load seniority tiers (filtered by company_id)
    $tierStmt = $conn->prepare("SELECT * FROM leave_seniority_tiers WHERE company_id = ? ORDER BY leave_type_id, min_years");
    $tierStmt->bind_param('i', $company_id);
    $tierStmt->execute();
    $tierResult = $tierStmt->get_result();
    if ($tierResult) {
        while ($tier = $tierResult->fetch_assoc()) {
            $ltId = (int)$tier['leave_type_id'];
            if (isset($types[$ltId])) {
                $types[$ltId]['seniority_tiers'][] = [
                    'id' => (int)$tier['id'],
                    'min_years' => (int)$tier['min_years'],
                    'days' => (int)$tier['days'],
                ];
            }
        }
    }

    json_response(array_values($types));
}

if ($method === 'POST') {
    require_admin($conn);
    $body = get_json_body();
    $reset_cycle = $body['reset_cycle'] ?? 'year';
    $probation_months = (int)($body['probation_months'] ?? 0);
    $grant_timing = $body['grant_timing'] ?? 'next_year';
    $prorate_first_year = (int)($body['prorate_first_year'] ?? 1);
    $advance_notice_days = (int)($body['advance_notice_days'] ?? 0);
    $auto_approve = (int)($body['auto_approve'] ?? 0);
    $icon_url = $body['icon_url'] ?? null;

    $stmt = $conn->prepare("INSERT INTO leave_types (company_id, name, default_quota, unit, type, reset_cycle, color, icon, icon_url, is_active, requires_doc, probation_months, grant_timing, prorate_first_year, advance_notice_days, auto_approve) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('isissssssiiisiii',
        $company_id,
        $body['name'], $body['default_quota'], $body['unit'], $body['type'],
        $reset_cycle, $body['color'], $body['icon'], $icon_url,
        $body['is_active'], $body['requires_doc'],
        $probation_months, $grant_timing, $prorate_first_year, $advance_notice_days, $auto_approve
    );
    $stmt->execute();
    $newId = $conn->insert_id;

    // Save seniority tiers if provided
    if (!empty($body['seniority_tiers']) && is_array($body['seniority_tiers'])) {
        $tierStmt = $conn->prepare("INSERT INTO leave_seniority_tiers (company_id, leave_type_id, min_years, days) VALUES (?, ?, ?, ?)");
        foreach ($body['seniority_tiers'] as $tier) {
            $tierStmt->bind_param('iiii', $company_id, $newId, $tier['min_years'], $tier['days']);
            $tierStmt->execute();
        }
    }

    json_response(['id' => $newId, 'message' => 'Created'], 201);
}

if ($method === 'PUT' && isset($_GET['id'])) {
    require_admin($conn);
    $id = (int)$_GET['id'];
    $body = get_json_body();
    $reset_cycle = $body['reset_cycle'] ?? 'year';
    $probation_months = (int)($body['probation_months'] ?? 0);
    $grant_timing = $body['grant_timing'] ?? 'next_year';
    $prorate_first_year = (int)($body['prorate_first_year'] ?? 1);
    $advance_notice_days = (int)($body['advance_notice_days'] ?? 0);
    $auto_approve = (int)($body['auto_approve'] ?? 0);
    $icon_url = $body['icon_url'] ?? null;

    $stmt = $conn->prepare("UPDATE leave_types SET name=?, default_quota=?, unit=?, type=?, reset_cycle=?, color=?, icon=?, icon_url=?, is_active=?, requires_doc=?, probation_months=?, grant_timing=?, prorate_first_year=?, advance_notice_days=?, auto_approve=? WHERE id=? AND company_id=?");
    $stmt->bind_param('sissssssiiisiiiii',
        $body['name'], $body['default_quota'], $body['unit'], $body['type'],
        $reset_cycle, $body['color'], $body['icon'], $icon_url,
        $body['is_active'], $body['requires_doc'],
        $probation_months, $grant_timing, $prorate_first_year, $advance_notice_days, $auto_approve,
        $id, $company_id
    );
    $stmt->execute();

    // Replace seniority tiers
    $conn->query("DELETE FROM leave_seniority_tiers WHERE leave_type_id = $id AND company_id = $company_id");
    if (!empty($body['seniority_tiers']) && is_array($body['seniority_tiers'])) {
        $tierStmt = $conn->prepare("INSERT INTO leave_seniority_tiers (company_id, leave_type_id, min_years, days) VALUES (?, ?, ?, ?)");
        foreach ($body['seniority_tiers'] as $tier) {
            $tierStmt->bind_param('iiii', $company_id, $id, $tier['min_years'], $tier['days']);
            $tierStmt->execute();
        }
    }

    json_response(['message' => 'Updated']);
}

if ($method === 'DELETE' && isset($_GET['id'])) {
    require_admin($conn);
    $id = (int)$_GET['id'];

    // Check if there are active or past leave requests using this leave type
    $checkStmt = $conn->prepare("SELECT id FROM leave_requests WHERE leave_type_id = ?");
    $checkStmt->bind_param('i', $id);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        json_response(['error' => 'Cannot delete leave type because there are historical requests using it. Please deactivate it instead.'], 400);
    }

    $stmt = $conn->prepare("DELETE FROM leave_types WHERE id = ? AND company_id = ?");
    $stmt->bind_param('ii', $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
