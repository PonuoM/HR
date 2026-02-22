<?php
/**
 * Attendance Alerts API
 * Checks for missing/incomplete clock records and creates notifications
 * 
 * GET ?action=check&employee_id=X → Check and return attendance alerts for past 7 working days
 * 
 * Dedup rules:
 *   - Notifications are only created ONCE per employee per alert-date per day
 *   - If user dismisses (reads/deletes), won't re-create until next day
 *   - Frontend caches results in sessionStorage to prevent stacking on re-mount
 */

require_once __DIR__ . '/config.php';

$company_id = get_company_id();
$method = get_method();
$action = $_GET['action'] ?? 'check';

if ($action !== 'check' || $method !== 'GET') {
    json_response(['error' => 'Invalid request'], 400);
}

$employee_id = get_employee_id();
if (!$employee_id) json_response(['error' => 'Missing employee ID header'], 400);

// ── Check if attendance_check activity is enabled ──
$actStmt = $conn->prepare("SELECT enabled, start_date FROM activity_settings WHERE company_id = ? AND activity_key = 'attendance_check'");
$actStmt->bind_param('i', $company_id);
$actStmt->execute();
$actRow = $actStmt->get_result()->fetch_assoc();

if (!$actRow || !$actRow['enabled'] || !$actRow['start_date']) {
    json_response(['alerts' => [], 'message' => 'Attendance check is not active']);
}

$startDate = $actRow['start_date']; // System start date
$today = date('Y-m-d');

// Don't check today (still working), start from yesterday
$checkDate = date('Y-m-d', strtotime('-1 day'));

// ── Get holidays for the company ──
$hStmt = $conn->prepare("SELECT date FROM holidays WHERE company_id = ? AND date BETWEEN ? AND ?");
$hStmt->bind_param('iss', $company_id, $startDate, $checkDate);
$hStmt->execute();
$hResult = $hStmt->get_result();
$holidays = [];
while ($h = $hResult->fetch_assoc()) {
    $holidays[] = $h['date'];
}

// ── Get approved leaves for this employee ──
$lvStmt = $conn->prepare(
    "SELECT lr.start_date, lr.end_date FROM leave_requests lr 
     WHERE lr.employee_id = ? AND lr.status = 'approved' 
     AND lr.end_date >= ? AND lr.start_date <= ?"
);
$lvStmt->bind_param('sss', $employee_id, $startDate, $checkDate);
$lvStmt->execute();
$lvResult = $lvStmt->get_result();
$leaveDays = [];
while ($lv = $lvResult->fetch_assoc()) {
    $cur = new DateTime($lv['start_date']);
    $end = new DateTime($lv['end_date']);
    while ($cur <= $end) {
        $leaveDays[] = $cur->format('Y-m-d');
        $cur->modify('+1 day');
    }
}

// ── Get attendance records ──
$attStmt = $conn->prepare(
    "SELECT date, clock_in, clock_out FROM attendance 
     WHERE employee_id = ? AND date BETWEEN ? AND ?"
);
$attStmt->bind_param('sss', $employee_id, $startDate, $checkDate);
$attStmt->execute();
$attResult = $attStmt->get_result();
$attendance = [];
while ($a = $attResult->fetch_assoc()) {
    $attendance[$a['date']] = $a;
}

// ── Get existing alert notification DATES created today (to avoid stacking) ──
// Key insight: we track which alert-dates were already notified TODAY
// If user clears them, they won't come back until tomorrow
$existStmt = $conn->prepare(
    "SELECT message FROM notifications 
     WHERE employee_id = ? AND type = 'attendance_alert' 
     AND DATE(created_at) = CURDATE()"
);
$existStmt->bind_param('s', $employee_id);
$existStmt->execute();
$existResult = $existStmt->get_result();
$existingAlerts = [];
while ($e = $existResult->fetch_assoc()) {
    $existingAlerts[] = $e['message'];
}

// ── Check working days (loop backward from yesterday, max 7 working days) ──
$alerts = [];
$workDaysChecked = 0;
$current = new DateTime($checkDate);
$startDt = new DateTime($startDate);

while ($workDaysChecked < 7 && $current >= $startDt) {
    $dateStr = $current->format('Y-m-d');
    $dow = (int)$current->format('N'); // 1=Mon, 7=Sun

    // Skip weekends
    if ($dow >= 6) {
        $current->modify('-1 day');
        continue;
    }

    // Skip holidays
    if (in_array($dateStr, $holidays)) {
        $current->modify('-1 day');
        continue;
    }

    // Skip approved leave days
    if (in_array($dateStr, $leaveDays)) {
        $current->modify('-1 day');
        $workDaysChecked++;
        continue;
    }

    $att = $attendance[$dateStr] ?? null;
    $thaiDate = thaiShortDate($dateStr);

    if (!$att) {
        $msg = "ไม่ได้ลงเวลาเข้างาน วันที่ $thaiDate";
        $alerts[] = [
            'date' => $dateStr,
            'type' => 'missing',
            'message' => $msg,
        ];

        // Only create notification if not already created TODAY
        if (!in_array($msg, $existingAlerts)) {
            $nStmt = $conn->prepare(
                "INSERT INTO notifications (employee_id, title, message, icon, icon_bg, type, icon_color) 
                 VALUES (?, 'ขาดลงเวลา', ?, 'error_outline', 'bg-red-100 dark:bg-red-900/30', 'attendance_alert', 'text-red-600')"
            );
            $nStmt->bind_param('ss', $employee_id, $msg);
            $nStmt->execute();
            $existingAlerts[] = $msg; // prevent within same request
        }
    } elseif ($att['clock_in'] && !$att['clock_out']) {
        $msg = "ลงเวลาไม่ครบ (ไม่ได้ลงเวลาออก) วันที่ $thaiDate";
        $alerts[] = [
            'date' => $dateStr,
            'type' => 'incomplete',
            'message' => $msg,
        ];

        if (!in_array($msg, $existingAlerts)) {
            $nStmt = $conn->prepare(
                "INSERT INTO notifications (employee_id, title, message, icon, icon_bg, type, icon_color) 
                 VALUES (?, 'ลงเวลาไม่ครบ', ?, 'warning_amber', 'bg-orange-100 dark:bg-orange-900/30', 'attendance_alert', 'text-orange-600')"
            );
            $nStmt->bind_param('ss', $employee_id, $msg);
            $nStmt->execute();
            $existingAlerts[] = $msg;
        }
    }

    $workDaysChecked++;
    $current->modify('-1 day');
}

// ══════════════════════════════════════════════════════════
// VOTE REMINDER: remind if <= 5 days left and haven't voted
// ══════════════════════════════════════════════════════════
$voteActStmt = $conn->prepare("SELECT enabled FROM activity_settings WHERE company_id = ? AND activity_key = 'employee_vote'");
$voteActStmt->bind_param('i', $company_id);
$voteActStmt->execute();
$voteActRow = $voteActStmt->get_result()->fetch_assoc();

if ($voteActRow && $voteActRow['enabled']) {
    $curMonth = (int)date('n');
    $curYear = (int)date('Y');
    $lastDay = (int)date('t'); // last day of current month
    $todayDay = (int)date('j');
    $daysLeft = $lastDay - $todayDay;

    if ($daysLeft <= 5) {
        // Check how many votes this employee has cast
        $voteStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM employee_votes WHERE voter_id = ? AND month = ? AND year = ? AND company_id = ?");
        $voteStmt->bind_param('siii', $employee_id, $curMonth, $curYear, $company_id);
        $voteStmt->execute();
        $votesUsed = (int)$voteStmt->get_result()->fetch_assoc()['cnt'];
        $maxVotes = 3;

        if ($votesUsed < $maxVotes) {
            $remaining = $maxVotes - $votesUsed;
            $deadlineDate = date('Y-m-t'); // last day of month
            $thaiDeadline = thaiShortDate($deadlineDate);

            if ($votesUsed === 0) {
                $voteMsg = "คุณยังไม่ได้โหวตพนักงานดีเด่นเดือนนี้ เหลืออีก $daysLeft วัน (หมดเขต $thaiDeadline)";
            } else {
                $voteMsg = "คุณยังเหลือสิทธิ์โหวต $remaining คะแนน เหลืออีก $daysLeft วัน (หมดเขต $thaiDeadline)";
            }

            $alerts[] = [
                'date' => $today,
                'type' => 'vote_reminder',
                'message' => $voteMsg,
            ];

            // Create notification if not already created today
            $voteExistStmt = $conn->prepare(
                "SELECT id FROM notifications WHERE employee_id = ? AND type = 'vote_reminder' AND DATE(created_at) = CURDATE()"
            );
            $voteExistStmt->bind_param('s', $employee_id);
            $voteExistStmt->execute();
            if ($voteExistStmt->get_result()->num_rows === 0) {
                $nStmt = $conn->prepare(
                    "INSERT INTO notifications (employee_id, title, message, icon, icon_bg, type, icon_color) 
                     VALUES (?, 'โหวตพนักงานดีเด่น', ?, 'how_to_vote', 'bg-amber-100 dark:bg-amber-900/30', 'vote_reminder', 'text-amber-600')"
                );
                $nStmt->bind_param('ss', $employee_id, $voteMsg);
                $nStmt->execute();
            }
        }
    }
}

json_response([
    'alerts' => $alerts,
    'total' => count($alerts),
    'start_date' => $startDate,
    'checked_up_to' => $checkDate,
]);

// ── Helper: Format date to Thai short format ──
function thaiShortDate($dateStr) {
    $months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    $d = new DateTime($dateStr);
    $day = (int)$d->format('j');
    $month = (int)$d->format('n');
    $year = (int)$d->format('Y') + 543;
    return "$day {$months[$month]} $year";
}
