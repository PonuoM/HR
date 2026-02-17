<?php
/**
 * Companies API (Superadmin Only)
 * GET    /api/companies.php       - List all companies
 * POST   /api/companies.php       - Create company
 * PUT    /api/companies.php?id=X  - Update company
 * DELETE /api/companies.php?id=X  - Toggle is_active (soft delete)
 */
require_once __DIR__ . '/config.php';

$method = get_method();

// --- Auth check: Only superadmin can access this API ---
// We check via X-Employee-Id header or fallback
function require_superadmin($conn) {
    $headers = getallheaders();
    $employeeId = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? null;
    if (!$employeeId) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    $stmt = $conn->prepare("SELECT is_superadmin FROM employees WHERE id = ?");
    $stmt->bind_param('s', $employeeId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    if (!$row || !$row['is_superadmin']) {
        json_response(['error' => 'Access denied: Superadmin only'], 403);
    }
}

require_superadmin($conn);

// ======================== GET ========================
if ($method === 'GET') {
    $result = $conn->query("SELECT * FROM companies ORDER BY id");
    $companies = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['is_active'] = (bool)(int)$row['is_active'];
        
        // Count employees per company
        $stmt = $conn->prepare("SELECT COUNT(*) as c FROM employees WHERE company_id = ? AND is_active = 1");
        $stmt->bind_param('i', $row['id']);
        $stmt->execute();
        $countRow = $stmt->get_result()->fetch_assoc();
        $row['employee_count'] = (int)$countRow['c'];
        
        $companies[] = $row;
    }
    json_response($companies);
}

// ======================== POST (Create) ========================
if ($method === 'POST') {
    $body = get_json_body();
    $code = strtoupper(trim($body['code'] ?? ''));
    $name = trim($body['name'] ?? '');
    $logo_url = $body['logo_url'] ?? null;

    if (!$code || !$name) {
        json_response(['error' => 'code and name are required'], 400);
    }

    if (strlen($code) > 20) {
        json_response(['error' => 'code must be 20 characters or less'], 400);
    }

    // Check duplicate code
    $check = $conn->prepare("SELECT id FROM companies WHERE code = ?");
    $check->bind_param('s', $code);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        json_response(['error' => 'รหัสบริษัทนี้ถูกใช้งานแล้ว'], 409);
    }

    $stmt = $conn->prepare("INSERT INTO companies (code, name, logo_url) VALUES (?, ?, ?)");
    $stmt->bind_param('sss', $code, $name, $logo_url);
    $stmt->execute();
    $newCompanyId = $conn->insert_id;

    // Auto-clone default leave types from company 1
    $ltResult = $conn->query("SELECT * FROM leave_types WHERE company_id = 1 ORDER BY id");
    if ($ltResult && $ltResult->num_rows > 0) {
        $insertLt = $conn->prepare("INSERT INTO leave_types (company_id, name, default_quota, unit, type, reset_cycle, color, icon, icon_url, is_active, requires_doc, probation_months, grant_timing, prorate_first_year, advance_notice_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $insertTier = $conn->prepare("INSERT INTO leave_seniority_tiers (company_id, leave_type_id, min_years, days) VALUES (?, ?, ?, ?)");

        while ($lt = $ltResult->fetch_assoc()) {
            $oldLtId = (int)$lt['id'];
            $insertLt->bind_param('isissssssiiisii',
                $newCompanyId,
                $lt['name'], $lt['default_quota'], $lt['unit'], $lt['type'],
                $lt['reset_cycle'], $lt['color'], $lt['icon'], $lt['icon_url'],
                $lt['is_active'], $lt['requires_doc'],
                $lt['probation_months'], $lt['grant_timing'], $lt['prorate_first_year'], $lt['advance_notice_days']
            );
            $insertLt->execute();
            $newLtId = $conn->insert_id;

            // Clone seniority tiers for this leave type
            $tierResult = $conn->query("SELECT * FROM leave_seniority_tiers WHERE company_id = 1 AND leave_type_id = $oldLtId ORDER BY min_years");
            if ($tierResult) {
                while ($tier = $tierResult->fetch_assoc()) {
                    $insertTier->bind_param('iiii', $newCompanyId, $newLtId, $tier['min_years'], $tier['days']);
                    $insertTier->execute();
                }
            }
        }
    }

    // Auto-clone departments from company 1
    $deptResult = $conn->query("SELECT name, work_start_time, work_end_time, work_hours_per_day, is_admin_system FROM departments WHERE company_id = 1 ORDER BY id");
    if ($deptResult && $deptResult->num_rows > 0) {
        $insertDept = $conn->prepare("INSERT INTO departments (company_id, name, work_start_time, work_end_time, work_hours_per_day, is_admin_system) VALUES (?, ?, ?, ?, ?, ?)");
        while ($dept = $deptResult->fetch_assoc()) {
            $insertDept->bind_param('isssdi', $newCompanyId, $dept['name'], $dept['work_start_time'], $dept['work_end_time'], $dept['work_hours_per_day'], $dept['is_admin_system']);
            $insertDept->execute();
        }
    }

    // Auto-clone positions from company 1
    $posResult = $conn->query("SELECT name, can_have_subordinates FROM positions WHERE company_id = 1 ORDER BY id");
    if ($posResult && $posResult->num_rows > 0) {
        $insertPos = $conn->prepare("INSERT INTO positions (company_id, name, can_have_subordinates) VALUES (?, ?, ?)");
        while ($pos = $posResult->fetch_assoc()) {
            $insertPos->bind_param('isi', $newCompanyId, $pos['name'], $pos['can_have_subordinates']);
            $insertPos->execute();
        }
    }

    json_response([
        'id' => $newCompanyId,
        'message' => 'Company created',
    ], 201);
}

// ======================== PUT (Update) ========================
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $body = json_decode(file_get_contents('php://input'), true);

    $code = strtoupper(trim($body['code'] ?? ''));
    $name = trim($body['name'] ?? '');
    $logo_url = $body['logo_url'] ?? null;
    $is_active = isset($body['is_active']) ? (int)$body['is_active'] : 1;

    if (!$code || !$name) {
        json_response(['error' => 'code and name are required'], 400);
    }

    // Check duplicate code (exclude self)
    $check = $conn->prepare("SELECT id FROM companies WHERE code = ? AND id != ?");
    $check->bind_param('si', $code, $id);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        json_response(['error' => 'รหัสบริษัทนี้ถูกใช้งานแล้ว'], 409);
    }

    $stmt = $conn->prepare("UPDATE companies SET code = ?, name = ?, logo_url = ?, is_active = ? WHERE id = ?");
    $stmt->bind_param('sssii', $code, $name, $logo_url, $is_active, $id);
    $stmt->execute();

    json_response(['message' => 'Company updated']);
}

// ======================== DELETE (Toggle Active) ========================
if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];

    // Don't allow deleting company with id=1 (default)
    if ($id === 1) {
        json_response(['error' => 'Cannot deactivate default company'], 400);
    }

    // Toggle is_active
    $stmt = $conn->prepare("UPDATE companies SET is_active = NOT is_active WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();

    json_response(['message' => 'Company status toggled']);
}

json_response(['error' => 'Method not allowed'], 405);
