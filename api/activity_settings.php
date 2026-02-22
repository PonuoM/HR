<?php
/**
 * Activity Settings API
 * Manage which activities/features are enabled for a company
 * 
 * GET  ?action=list      → List all activity settings
 * POST ?action=toggle     → Toggle an activity on/off { key, enabled }
 * GET  ?action=check&key= → Check if specific activity is enabled
 * POST ?action=set_start_date → Set global system start date { start_date }
 * GET  ?action=get_start_date → Get system start date
 */

require_once __DIR__ . '/config.php';

$company_id = get_company_id();

// ── Auto-create table ──
$conn->query("CREATE TABLE IF NOT EXISTS activity_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    activity_key VARCHAR(50) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    label VARCHAR(100) NOT NULL,
    description VARCHAR(255) DEFAULT '',
    icon VARCHAR(50) DEFAULT 'extension',
    sort_order INT DEFAULT 0,
    start_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_company_activity (company_id, activity_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ── Auto-add start_date column if missing (upgrade path) ──
$colCheck = $conn->query("SHOW COLUMNS FROM activity_settings LIKE 'start_date'");
if ($colCheck->num_rows === 0) {
    $conn->query("ALTER TABLE activity_settings ADD COLUMN start_date DATE DEFAULT NULL AFTER sort_order");
}

// ── Seed default activities (INSERT IGNORE = safe to run every time) ──
$defaults = [
    ['employee_vote', 1, 'โหวตพนักงานดีเด่น', 'ระบบโหวตพนักงานดีเด่นประจำเดือน', 'emoji_events', 1],
    ['attendance_check', 0, 'ตรวจสอบการลงเวลา', 'แจ้งเตือนเมื่อพนักงานไม่ได้ลงเวลาหรือลงไม่ครบ (จ-ศ)', 'schedule', 2],
];
$ins = $conn->prepare("INSERT IGNORE INTO activity_settings (company_id, activity_key, enabled, label, description, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
foreach ($defaults as $d) {
    $ins->bind_param('isisssi', $company_id, $d[0], $d[1], $d[2], $d[3], $d[4], $d[5]);
    $ins->execute();
}

$action = $_GET['action'] ?? 'list';
$method = get_method();

// ═══ LIST ═══
if ($action === 'list' && $method === 'GET') {
    $stmt = $conn->prepare("SELECT id, activity_key, enabled, label, description, icon, sort_order, start_date FROM activity_settings WHERE company_id = ? ORDER BY sort_order, label");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $activities = [];
    while ($r = $result->fetch_assoc()) {
        $r['enabled'] = (bool)$r['enabled'];
        $activities[] = $r;
    }
    json_response($activities);
}

// ═══ TOGGLE ═══
if ($action === 'toggle' && $method === 'POST') {
    $data = get_json_body();
    $key = $data['key'] ?? null;
    $enabled = isset($data['enabled']) ? (int)$data['enabled'] : null;

    if (!$key || $enabled === null) json_response(['error' => 'Missing key or enabled'], 400);

    // If enabling and no start_date yet → set today
    if ($enabled === 1) {
        $chkDate = $conn->prepare("SELECT start_date FROM activity_settings WHERE company_id = ? AND activity_key = ?");
        $chkDate->bind_param('is', $company_id, $key);
        $chkDate->execute();
        $dateRow = $chkDate->get_result()->fetch_assoc();
        if ($dateRow && !$dateRow['start_date']) {
            $today = date('Y-m-d');
            $setDate = $conn->prepare("UPDATE activity_settings SET start_date = ? WHERE company_id = ? AND activity_key = ?");
            $setDate->bind_param('sis', $today, $company_id, $key);
            $setDate->execute();
        }
    }

    $stmt = $conn->prepare("UPDATE activity_settings SET enabled = ? WHERE company_id = ? AND activity_key = ?");
    $stmt->bind_param('iis', $enabled, $company_id, $key);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        $chk = $conn->prepare("SELECT id FROM activity_settings WHERE company_id = ? AND activity_key = ?");
        $chk->bind_param('is', $company_id, $key);
        $chk->execute();
        if ($chk->get_result()->num_rows === 0) {
            json_response(['error' => 'Activity not found'], 404);
        }
    }

    json_response(['success' => true, 'key' => $key, 'enabled' => (bool)$enabled]);
}

// ═══ CHECK ═══
if ($action === 'check' && $method === 'GET') {
    $key = $_GET['key'] ?? null;
    if (!$key) json_response(['error' => 'Missing key'], 400);

    $stmt = $conn->prepare("SELECT enabled, start_date FROM activity_settings WHERE company_id = ? AND activity_key = ?");
    $stmt->bind_param('is', $company_id, $key);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();

    json_response([
        'key' => $key,
        'enabled' => $row ? (bool)$row['enabled'] : false,
        'start_date' => $row['start_date'] ?? null,
    ]);
}

// ═══ SET START DATE ═══
if ($action === 'set_start_date' && $method === 'POST') {
    $data = get_json_body();
    $start_date = $data['start_date'] ?? null;

    if (!$start_date) json_response(['error' => 'Missing start_date'], 400);

    // Set start_date for ALL activities of this company
    $stmt = $conn->prepare("UPDATE activity_settings SET start_date = ? WHERE company_id = ?");
    $stmt->bind_param('si', $start_date, $company_id);
    $stmt->execute();

    json_response(['success' => true, 'start_date' => $start_date, 'affected' => $stmt->affected_rows]);
}

// ═══ GET START DATE (global system start date) ═══
if ($action === 'get_start_date' && $method === 'GET') {
    $stmt = $conn->prepare("SELECT MIN(start_date) as start_date FROM activity_settings WHERE company_id = ? AND start_date IS NOT NULL");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    json_response(['start_date' => $row['start_date'] ?? null]);
}

json_response(['error' => 'Invalid action'], 400);
