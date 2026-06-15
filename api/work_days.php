<?php
/**
 * Extra Working Days API ("วันทำงานพิเศษ") — Multi-Company
 * The positive counterpart of holidays.php. Marks a normally-off day as a
 * working day, scoped to the whole company, a department, or one employee.
 *
 * GET    /api/work_days.php?year=2026   — list overrides for a year (+ departments)
 * POST   /api/work_days.php             — create one override
 * DELETE /api/work_days.php?id=X        — delete one override
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$company_id = get_company_id();

// ======================== GET ========================
if ($method === 'GET') {
    $year = isset($_GET['year']) ? intval($_GET['year']) : (int)date('Y');

    $stmt = $conn->prepare(
        "SELECT w.id, w.date, w.scope, w.department_id, d.name AS department_name,
                w.employee_id, e.name AS employee_name, w.note
         FROM work_day_overrides w
         LEFT JOIN departments d ON w.department_id = d.id
         LEFT JOIN employees e ON w.employee_id = e.id
         WHERE w.company_id = ? AND YEAR(w.date) = ?
         ORDER BY w.date ASC, w.scope ASC"
    );
    $stmt->bind_param('ii', $company_id, $year);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['department_id'] = $row['department_id'] !== null ? (int)$row['department_id'] : null;
        $items[] = $row;
    }

    // Departments (for the scope=department picker)
    $departments = [];
    $dStmt = $conn->prepare("SELECT id, name FROM departments WHERE company_id = ? ORDER BY name");
    $dStmt->bind_param('i', $company_id);
    $dStmt->execute();
    $dRes = $dStmt->get_result();
    while ($d = $dRes->fetch_assoc()) {
        $d['id'] = (int)$d['id'];
        $departments[] = $d;
    }

    // Available years
    $yStmt = $conn->prepare("SELECT DISTINCT YEAR(date) AS y FROM work_day_overrides WHERE company_id = ? ORDER BY y DESC");
    $yStmt->bind_param('i', $company_id);
    $yStmt->execute();
    $yRes = $yStmt->get_result();
    $years = [];
    while ($y = $yRes->fetch_assoc()) $years[] = (int)$y['y'];
    $currentYear = (int)date('Y');
    if (!in_array($currentYear, $years)) $years[] = $currentYear;
    if (!in_array($currentYear + 1, $years)) $years[] = $currentYear + 1;
    rsort($years);

    json_response([
        'work_days' => $items,
        'departments' => $departments,
        'year' => $year,
        'available_years' => $years,
        'total' => count($items),
    ]);
}

// ======================== POST (Create) ========================
if ($method === 'POST') {
    $actor_id = require_admin($conn);
    $body = get_json_body();

    $date  = $body['date'] ?? '';
    $scope = $body['scope'] ?? 'company';
    $note  = isset($body['note']) && $body['note'] !== '' ? $body['note'] : null;

    if (!$date) {
        json_response(['error' => 'date is required'], 400);
    }
    if (!in_array($scope, ['company', 'department', 'employee'], true)) {
        json_response(['error' => 'invalid scope'], 400);
    }

    $department_id = null;
    $employee_id = null;
    if ($scope === 'department') {
        $department_id = isset($body['department_id']) ? (int)$body['department_id'] : 0;
        if (!$department_id) json_response(['error' => 'department_id is required for department scope'], 400);
    } elseif ($scope === 'employee') {
        $employee_id = $body['employee_id'] ?? '';
        if ($employee_id === '') json_response(['error' => 'employee_id is required for employee scope'], 400);
    }

    // Duplicate check: same company + date + scope + target
    $dupSql = "SELECT id FROM work_day_overrides WHERE company_id = ? AND date = ? AND scope = ?
               AND ((? IS NULL AND department_id IS NULL) OR department_id = ?)
               AND ((? IS NULL AND employee_id IS NULL) OR employee_id = ?)";
    $dupStmt = $conn->prepare($dupSql);
    $dupStmt->bind_param('issiiss', $company_id, $date, $scope, $department_id, $department_id, $employee_id, $employee_id);
    $dupStmt->execute();
    if ($dupStmt->get_result()->num_rows > 0) {
        json_response(['error' => 'วันทำงานพิเศษนี้ (ขอบเขตเดียวกัน) มีอยู่แล้ว'], 409);
    }

    $stmt = $conn->prepare(
        "INSERT INTO work_day_overrides (company_id, date, scope, department_id, employee_id, note, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param('ississs', $company_id, $date, $scope, $department_id, $employee_id, $note, $actor_id);
    $stmt->execute();

    json_response(['id' => $conn->insert_id, 'message' => 'Created'], 201);
}

// ======================== DELETE ========================
if ($method === 'DELETE' && isset($_GET['id'])) {
    require_admin($conn);
    $id = (int)$_GET['id'];
    $stmt = $conn->prepare("DELETE FROM work_day_overrides WHERE id = ? AND company_id = ?");
    $stmt->bind_param('ii', $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
