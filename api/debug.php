<?php
/**
 * Debug: Check database tables and columns
 * Access via: https://hr.prima49.com/api/debug.php
 * DELETE THIS FILE AFTER USE!
 */
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$results = [];

// === 1. Check which tables exist ===
$expected_tables = [
    'employees',
    'departments',
    'positions',
    'check_ins',
    'leave_requests',
    'leave_quotas',
    'leave_seniority_tiers',
    'notifications',
    'news',
    'news_comments',
    'payslips',
    'time_records',
    'approval_tracking',
    'holidays',
    'companies',
    'work_locations',
    'active_sessions',
    'security_alerts',
    'face_descriptors',
    'push_subscriptions',
];

$existing = [];
$missing = [];
$res = $conn->query("SHOW TABLES");
$all_tables = [];
while ($row = $res->fetch_row()) {
    $all_tables[] = $row[0];
}

foreach ($expected_tables as $table) {
    if (in_array($table, $all_tables)) {
        $existing[] = $table;
    } else {
        $missing[] = $table;
    }
}

$results['all_tables_in_db'] = $all_tables;
$results['expected_tables'] = $expected_tables;
$results['existing'] = $existing;
$results['missing'] = $missing;

// === 2. Check key columns in employees table ===
$employee_columns = [];
$res2 = $conn->query("SHOW COLUMNS FROM employees");
if ($res2) {
    while ($col = $res2->fetch_assoc()) {
        $employee_columns[] = $col['Field'];
    }
}

$expected_employee_cols = [
    'id', 'name', 'email', 'password', 'role', 'department_id', 'position_id',
    'phone', 'avatar', 'is_active', 'company_id',
    'device_fingerprint', 'device_registered_at',
    'base_salary', 'hire_date', 'terminated_at',
];

$missing_cols = array_diff($expected_employee_cols, $employee_columns);
$results['employee_columns'] = $employee_columns;
$results['missing_employee_columns'] = array_values($missing_cols);

// === 3. Summary ===
$results['summary'] = [
    'total_tables' => count($all_tables),
    'expected' => count($expected_tables),
    'existing' => count($existing),
    'missing_count' => count($missing),
    'missing_tables' => $missing,
    'missing_employee_cols' => array_values($missing_cols),
    'status' => count($missing) === 0 && count($missing_cols) === 0 ? '✅ ALL OK' : '⚠️ NEEDS MIGRATION',
];

echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
