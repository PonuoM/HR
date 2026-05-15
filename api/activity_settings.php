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

// ── Auto-add external_url + audience columns (upgrade path for v3 link activities) ──
$urlCheck = $conn->query("SHOW COLUMNS FROM activity_settings LIKE 'external_url'");
if ($urlCheck->num_rows === 0) {
    $conn->query("ALTER TABLE activity_settings ADD COLUMN external_url VARCHAR(500) DEFAULT NULL AFTER icon");
}
$audCheck = $conn->query("SHOW COLUMNS FROM activity_settings LIKE 'audience'");
if ($audCheck->num_rows === 0) {
    $conn->query("ALTER TABLE activity_settings ADD COLUMN audience ENUM('all','admin') NOT NULL DEFAULT 'all' AFTER external_url");
}

// ── Auto-create extra-viewers table (admin-only links can grant exceptions to specific non-admin staff) ──
$conn->query("CREATE TABLE IF NOT EXISTS activity_extra_viewers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    employee_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_act_emp (activity_id, employee_id),
    INDEX idx_employee (employee_id),
    CONSTRAINT fk_extra_act FOREIGN KEY (activity_id) REFERENCES activity_settings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ── Seed default activities (INSERT IGNORE = safe to run every time) ──
// columns: key, enabled, label, description, icon, external_url, audience, sort_order
$defaults = [
    ['employee_vote',     1, 'โหวตพนักงานดีเด่น',  'ระบบโหวตพนักงานดีเด่นประจำเดือน',                            'emoji_events',  null,                                          'all',   1],
    ['attendance_check',  0, 'ตรวจสอบการลงเวลา',   'แจ้งเตือนเมื่อพนักงานไม่ได้ลงเวลาหรือลงไม่ครบ (จ-ศ)',          'schedule',      null,                                          'all',   2],
    ['asset_management',  1, 'ระบบการเบิก',         'จัดการระบบเบิกวัสดุ (สำหรับแอดมินหลังบ้าน)',                  'inventory_2',   'https://asset.prima49.com/index.php',         'admin', 10],
    ['material_request',  1, 'เบิกวัสดุ',            'ขอเบิกวัสดุสิ้นเปลือง',                                       'shopping_cart', 'https://asset.prima49.com/user_request.php',  'all',   11],
];
// Types: i (company_id) s i s s s s s i  →  9 binds
$ins = $conn->prepare("INSERT IGNORE INTO activity_settings (company_id, activity_key, enabled, label, description, icon, external_url, audience, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
foreach ($defaults as $d) {
    $ins->bind_param('isisssssi', $company_id, $d[0], $d[1], $d[2], $d[3], $d[4], $d[5], $d[6], $d[7]);
    $ins->execute();
}

$action = $_GET['action'] ?? 'list';
$method = get_method();

// ═══ LIST ═══
if ($action === 'list' && $method === 'GET') {
    $stmt = $conn->prepare("SELECT id, activity_key, enabled, label, description, icon, external_url, audience, sort_order, start_date FROM activity_settings WHERE company_id = ? ORDER BY sort_order, label");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $activities = [];
    $idsByKey = [];
    while ($r = $result->fetch_assoc()) {
        $r['enabled'] = (bool)$r['enabled'];
        $r['extra_viewers'] = []; // populated below
        $idsByKey[(int)$r['id']] = count($activities);
        $activities[] = $r;
    }

    // Pull extra viewers in one round-trip and bucket them by activity_id.
    if ($activities) {
        $ids = array_keys($idsByKey);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $types = str_repeat('i', count($ids));
        $vstmt = $conn->prepare("SELECT activity_id, employee_id FROM activity_extra_viewers WHERE activity_id IN ($placeholders)");
        $vstmt->bind_param($types, ...$ids);
        $vstmt->execute();
        $vres = $vstmt->get_result();
        while ($v = $vres->fetch_assoc()) {
            $idx = $idsByKey[(int)$v['activity_id']] ?? null;
            if ($idx !== null) $activities[$idx]['extra_viewers'][] = $v['employee_id'];
        }
    }

    json_response($activities);
}

// ═══ ADD VIEWER (admin) — grant a non-admin employee access to an admin-only link ═══
if ($action === 'add_viewer' && $method === 'POST') {
    require_admin($conn);
    $data = get_json_body();
    $key = $data['key'] ?? null;
    $emp = $data['employee_id'] ?? null;
    if (!$key || !$emp) json_response(['error' => 'Missing key or employee_id'], 400);

    // Resolve activity_id within this company so cross-company tampering is impossible.
    $find = $conn->prepare("SELECT id FROM activity_settings WHERE company_id = ? AND activity_key = ?");
    $find->bind_param('is', $company_id, $key);
    $find->execute();
    $row = $find->get_result()->fetch_assoc();
    if (!$row) json_response(['error' => 'Activity not found'], 404);
    $aid = (int)$row['id'];

    // Sanity-check that the employee belongs to the same company.
    $emp_check = $conn->prepare("SELECT id FROM employees WHERE id = ? AND company_id = ?");
    $emp_check->bind_param('si', $emp, $company_id);
    $emp_check->execute();
    if ($emp_check->get_result()->num_rows === 0) {
        json_response(['error' => 'Employee not found in this company'], 404);
    }

    $ins = $conn->prepare("INSERT IGNORE INTO activity_extra_viewers (activity_id, employee_id) VALUES (?, ?)");
    $ins->bind_param('is', $aid, $emp);
    $ins->execute();
    json_response(['success' => true, 'key' => $key, 'employee_id' => $emp, 'added' => $ins->affected_rows > 0]);
}

// ═══ REMOVE VIEWER (admin) ═══
if ($action === 'remove_viewer' && $method === 'POST') {
    require_admin($conn);
    $data = get_json_body();
    $key = $data['key'] ?? null;
    $emp = $data['employee_id'] ?? null;
    if (!$key || !$emp) json_response(['error' => 'Missing key or employee_id'], 400);

    // Same company-scoped resolve.
    $find = $conn->prepare("SELECT id FROM activity_settings WHERE company_id = ? AND activity_key = ?");
    $find->bind_param('is', $company_id, $key);
    $find->execute();
    $row = $find->get_result()->fetch_assoc();
    if (!$row) json_response(['error' => 'Activity not found'], 404);
    $aid = (int)$row['id'];

    $del = $conn->prepare("DELETE FROM activity_extra_viewers WHERE activity_id = ? AND employee_id = ?");
    $del->bind_param('is', $aid, $emp);
    $del->execute();
    json_response(['success' => true, 'key' => $key, 'employee_id' => $emp, 'removed' => $del->affected_rows]);
}

// ═══ UPDATE LINK (admin) — change external_url and/or audience for a link activity ═══
if ($action === 'update_link' && $method === 'POST') {
    require_admin($conn);
    $data = get_json_body();
    $key = $data['key'] ?? null;
    if (!$key) json_response(['error' => 'Missing key'], 400);

    $url = array_key_exists('external_url', $data) ? trim((string)$data['external_url']) : null;
    $audience = $data['audience'] ?? null;
    if ($audience !== null && !in_array($audience, ['all', 'admin'], true)) {
        json_response(['error' => 'audience must be all or admin'], 400);
    }
    if ($url !== null && $url !== '' && !preg_match('#^https?://#i', $url)) {
        json_response(['error' => 'external_url must be http(s)://...'], 400);
    }

    // Build dynamic UPDATE — only touch fields the caller actually provided
    $sets = [];
    $types = '';
    $vals = [];
    if ($url !== null) {
        $sets[] = 'external_url = ?';
        $types .= 's';
        $vals[] = $url === '' ? null : $url;
    }
    if ($audience !== null) {
        $sets[] = 'audience = ?';
        $types .= 's';
        $vals[] = $audience;
    }
    if (!$sets) json_response(['error' => 'Nothing to update'], 400);

    $types .= 'is';
    $vals[] = $company_id;
    $vals[] = $key;

    $sql = "UPDATE activity_settings SET " . implode(', ', $sets) . " WHERE company_id = ? AND activity_key = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$vals);
    $stmt->execute();
    json_response(['success' => true, 'key' => $key, 'affected' => $stmt->affected_rows]);
}

// ═══ TOGGLE ═══
if ($action === 'toggle' && $method === 'POST') {
    require_admin($conn);
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
    require_admin($conn);
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
