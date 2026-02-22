<?php
/**
 * Employee Star Vote API (Multi-Company)
 *
 * GET    ?action=candidates                          - List votable employees
 * GET    ?action=my_votes&month=X&year=Y             - My votes this month
 * POST   ?action=vote                                - Cast a vote
 * DELETE ?action=vote&id=X                           - Remove a vote
 * GET    ?action=leaderboard&month=X&year=Y          - Top 5 of a closed month
 * GET    ?action=my_score&year=Y                     - My yearly score + streak
 * GET    ?action=yearly_ranking&year=Y               - Full year ranking
 * POST   ?action=close_month&month=X&year=Y          - Admin: compute monthly scores
 * GET    ?action=status&month=X&year=Y               - Voting status for current user
 */
require_once __DIR__ . '/config.php';

$company_id = get_company_id();
$method = get_method();
$action = $_GET['action'] ?? '';

// ── Auto-create tables ──
$conn->query("CREATE TABLE IF NOT EXISTS `employee_votes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `voter_id` VARCHAR(20) NOT NULL,
  `voted_for_id` VARCHAR(20) NOT NULL,
  `month` INT NOT NULL,
  `year` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_voter_target` (`voter_id`, `voted_for_id`, `month`, `year`),
  KEY `idx_month_year` (`company_id`, `month`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$conn->query("CREATE TABLE IF NOT EXISTS `employee_vote_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `employee_id` VARCHAR(20) NOT NULL,
  `month` INT NOT NULL,
  `year` INT NOT NULL,
  `participation_score` INT DEFAULT 0,
  `received_score` INT DEFAULT 0,
  `penalty` INT DEFAULT 0,
  `streak_bonus` INT DEFAULT 0,
  `total_score` INT DEFAULT 0,
  `votes_used` INT DEFAULT 0,
  `is_exempt` TINYINT(1) DEFAULT 0,
  UNIQUE KEY `uq_emp_month` (`employee_id`, `month`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// ── Helpers ──
$MAX_VOTES = 3;
$STREAK_MONTHS = 3;
$STREAK_BONUS = 2;

function get_current_month() { return (int)($_GET['month'] ?? date('n')); }
function get_current_year()  { return (int)($_GET['year']  ?? date('Y')); }

// ════════════════════════════════════════════════════════
// GET: List candidate employees (everyone except self)
// ════════════════════════════════════════════════════════
if ($method === 'GET' && $action === 'candidates') {
    $headers = getallheaders();
    $myId = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? '';
    $stmt = $conn->prepare(
        "SELECT e.id, e.name, e.avatar, d.name AS department, p.name AS position
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN positions p ON e.position_id = p.id
         WHERE e.company_id = ? AND e.is_active = 1 AND e.id != ?
         ORDER BY e.name"
    );
    $stmt->bind_param('is', $company_id, $myId);
    $stmt->execute();
    $result = $stmt->get_result();
    $list = [];
    while ($row = $result->fetch_assoc()) $list[] = $row;
    json_response($list);
}

// ════════════════════════════════════════════════════════
// GET: My votes this month
// ════════════════════════════════════════════════════════
if ($method === 'GET' && $action === 'my_votes') {
    $headers = getallheaders();
    $myId = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? '';
    $month = get_current_month();
    $year = get_current_year();

    $stmt = $conn->prepare(
        "SELECT v.id, v.voted_for_id, e.name, e.avatar, d.name AS department
         FROM employee_votes v
         JOIN employees e ON v.voted_for_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE v.voter_id = ? AND v.month = ? AND v.year = ? AND v.company_id = ?
         ORDER BY v.created_at"
    );
    $stmt->bind_param('siii', $myId, $month, $year, $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $votes = [];
    while ($row = $result->fetch_assoc()) $votes[] = $row;
    json_response([
        'votes' => $votes,
        'votes_used' => count($votes),
        'votes_remaining' => $MAX_VOTES - count($votes),
    ]);
}

// ════════════════════════════════════════════════════════
// GET: Voting status (have I voted? is month still open?)
// ════════════════════════════════════════════════════════
if ($method === 'GET' && $action === 'status') {
    $headers = getallheaders();
    $myId = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? '';
    $month = get_current_month();
    $year = get_current_year();

    $currentMonth = (int)date('n');
    $currentYear = (int)date('Y');
    $isOpen = ($month === $currentMonth && $year === $currentYear);

    $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM employee_votes WHERE voter_id = ? AND month = ? AND year = ? AND company_id = ?");
    $stmt->bind_param('siii', $myId, $month, $year, $company_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $votesUsed = (int)$row['cnt'];

    json_response([
        'month' => $month,
        'year' => $year,
        'is_open' => $isOpen,
        'votes_used' => $votesUsed,
        'votes_remaining' => $MAX_VOTES - $votesUsed,
        'max_votes' => $MAX_VOTES,
    ]);
}

// ════════════════════════════════════════════════════════
// POST: Cast a vote
// ════════════════════════════════════════════════════════
if ($method === 'POST' && $action === 'vote') {
    $body = get_json_body();
    $voterId = $body['voter_id'] ?? '';
    $votedForId = $body['voted_for_id'] ?? '';
    $month = (int)($body['month'] ?? date('n'));
    $year = (int)($body['year'] ?? date('Y'));

    // Validate: not empty
    if (!$voterId || !$votedForId) json_response(['error' => 'voter_id and voted_for_id required'], 400);

    // Validate: can't vote for self
    if ($voterId === $votedForId) json_response(['error' => 'ไม่สามารถโหวตให้ตัวเองได้'], 400);

    // Validate: month must be current
    if ($month !== (int)date('n') || $year !== (int)date('Y'))
        json_response(['error' => 'สามารถโหวตได้เฉพาะเดือนปัจจุบันเท่านั้น'], 400);

    // Validate: max votes
    $countStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM employee_votes WHERE voter_id = ? AND month = ? AND year = ? AND company_id = ?");
    $countStmt->bind_param('siii', $voterId, $month, $year, $company_id);
    $countStmt->execute();
    $countRow = $countStmt->get_result()->fetch_assoc();
    if ((int)$countRow['cnt'] >= $MAX_VOTES)
        json_response(['error' => 'ใช้โหวตครบ 3 คะแนนแล้วในเดือนนี้'], 400);

    // Validate: 1 vote per target per month
    $dupStmt = $conn->prepare("SELECT id FROM employee_votes WHERE voter_id = ? AND voted_for_id = ? AND month = ? AND year = ?");
    $dupStmt->bind_param('ssii', $voterId, $votedForId, $month, $year);
    $dupStmt->execute();
    if ($dupStmt->get_result()->num_rows > 0)
        json_response(['error' => 'คุณเคยโหวตให้คนนี้แล้วในเดือนนี้'], 400);

    // Validate: voted_for must be active employee
    $activeStmt = $conn->prepare("SELECT id FROM employees WHERE id = ? AND is_active = 1 AND company_id = ?");
    $activeStmt->bind_param('si', $votedForId, $company_id);
    $activeStmt->execute();
    if ($activeStmt->get_result()->num_rows === 0)
        json_response(['error' => 'ไม่พบพนักงานที่ต้องการโหวต'], 404);

    // Insert vote
    $ins = $conn->prepare("INSERT INTO employee_votes (company_id, voter_id, voted_for_id, month, year) VALUES (?, ?, ?, ?, ?)");
    $ins->bind_param('issii', $company_id, $voterId, $votedForId, $month, $year);
    $ins->execute();

    json_response(['message' => 'โหวตสำเร็จ', 'id' => $conn->insert_id], 201);
}

// ════════════════════════════════════════════════════════
// DELETE: Remove a vote (edit within month)
// ════════════════════════════════════════════════════════
if ($method === 'DELETE' && $action === 'vote' && isset($_GET['id'])) {
    $voteId = (int)$_GET['id'];
    $headers = getallheaders();
    $myId = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? '';
    $currentMonth = (int)date('n');
    $currentYear = (int)date('Y');

    // Verify ownership + same month
    $check = $conn->prepare("SELECT * FROM employee_votes WHERE id = ? AND voter_id = ? AND month = ? AND year = ?");
    $check->bind_param('isii', $voteId, $myId, $currentMonth, $currentYear);
    $check->execute();
    if ($check->get_result()->num_rows === 0)
        json_response(['error' => 'ไม่พบโหวตนี้ หรือไม่สามารถลบได้'], 404);

    $conn->prepare("DELETE FROM employee_votes WHERE id = ?")->bind_param('i', $voteId);
    $conn->query("DELETE FROM employee_votes WHERE id = $voteId");
    json_response(['message' => 'ลบโหวตแล้ว']);
}

// ════════════════════════════════════════════════════════
// GET: Leaderboard (only for past months)
// ════════════════════════════════════════════════════════
if ($method === 'GET' && $action === 'leaderboard') {
    $month = get_current_month();
    $year = get_current_year();

    // Block viewing current month
    $curMonth = (int)date('n');
    $curYear = (int)date('Y');
    if ($year > $curYear || ($year === $curYear && $month >= $curMonth)) {
        json_response(['error' => 'ยังไม่สามารถดูผลเดือนนี้ได้', 'is_current' => true], 403);
    }

    // Score-based leaderboard
    $stmt = $conn->prepare(
        "SELECT s.employee_id, e.name, e.avatar, d.name AS department,
                s.received_score, s.participation_score, s.total_score
         FROM employee_vote_scores s
         JOIN employees e ON s.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE s.company_id = ? AND s.month = ? AND s.year = ?
         ORDER BY s.received_score DESC
         LIMIT 5"
    );
    $stmt->bind_param('iii', $company_id, $month, $year);
    $stmt->execute();
    $result = $stmt->get_result();
    $board = [];
    while ($row = $result->fetch_assoc()) $board[] = $row;
    json_response(['month' => $month, 'year' => $year, 'leaderboard' => $board]);
}

// ════════════════════════════════════════════════════════
// GET: My yearly score + streak
// ════════════════════════════════════════════════════════
if ($method === 'GET' && $action === 'my_score') {
    $headers = getallheaders();
    $myId = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? '';
    $year = get_current_year();

    $stmt = $conn->prepare(
        "SELECT month, participation_score, received_score, penalty, streak_bonus, total_score, votes_used
         FROM employee_vote_scores
         WHERE employee_id = ? AND year = ? AND company_id = ?
         ORDER BY month"
    );
    $stmt->bind_param('sii', $myId, $year, $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $months = [];
    $totalYear = 0;
    $streak = 0;
    while ($row = $result->fetch_assoc()) {
        $row['participation_score'] = (int)$row['participation_score'];
        $row['received_score'] = (int)$row['received_score'];
        $row['penalty'] = (int)$row['penalty'];
        $row['streak_bonus'] = (int)$row['streak_bonus'];
        $row['total_score'] = (int)$row['total_score'];
        $totalYear += $row['total_score'];
        if ((int)$row['votes_used'] >= $MAX_VOTES) $streak++; else $streak = 0;
        $months[] = $row;
    }

    json_response([
        'employee_id' => $myId,
        'year' => $year,
        'total_yearly_score' => $totalYear,
        'current_streak' => $streak,
        'months' => $months,
    ]);
}

// ════════════════════════════════════════════════════════
// GET: Yearly ranking
// ════════════════════════════════════════════════════════
if ($method === 'GET' && $action === 'yearly_ranking') {
    $year = get_current_year();
    $stmt = $conn->prepare(
        "SELECT s.employee_id, e.name, e.avatar, d.name AS department,
                SUM(s.total_score) AS yearly_score
         FROM employee_vote_scores s
         JOIN employees e ON s.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE s.company_id = ? AND s.year = ? AND e.is_active = 1
         GROUP BY s.employee_id
         ORDER BY yearly_score DESC"
    );
    $stmt->bind_param('ii', $company_id, $year);
    $stmt->execute();
    $result = $stmt->get_result();
    $ranking = [];
    while ($row = $result->fetch_assoc()) {
        $row['yearly_score'] = (int)$row['yearly_score'];
        $ranking[] = $row;
    }
    json_response(['year' => $year, 'ranking' => $ranking]);
}

// ════════════════════════════════════════════════════════
// POST: Close month — compute scores (admin only)
// ════════════════════════════════════════════════════════
if ($method === 'POST' && $action === 'close_month') {
    $body = get_json_body();
    $month = (int)($body['month'] ?? 0);
    $year = (int)($body['year'] ?? 0);
    if (!$month || !$year) json_response(['error' => 'month and year required'], 400);

    // Get all active employees in this company
    $empResult = $conn->query("SELECT id, hire_date FROM employees WHERE company_id = $company_id AND is_active = 1");
    $employees = [];
    while ($e = $empResult->fetch_assoc()) $employees[] = $e;

    $processed = 0;
    foreach ($employees as $emp) {
        $empId = $emp['id'];

        // Check exemptions: new hire this month or long leave (≥15 days)
        $isExempt = 0;
        if (!empty($emp['hire_date'])) {
            $hireDate = new DateTime($emp['hire_date']);
            if ((int)$hireDate->format('n') === $month && (int)$hireDate->format('Y') === $year) {
                $isExempt = 1;
            }
        }
        // Check leave days this month
        $monthStart = sprintf('%04d-%02d-01', $year, $month);
        $monthEnd = date('Y-m-t', strtotime($monthStart));
        $leaveStmt = $conn->prepare(
            "SELECT COALESCE(SUM(total_days), 0) as leave_days FROM leave_requests
             WHERE employee_id = ? AND status = 'approved'
             AND start_date <= ? AND end_date >= ?"
        );
        $leaveStmt->bind_param('sss', $empId, $monthEnd, $monthStart);
        $leaveStmt->execute();
        $leaveRow = $leaveStmt->get_result()->fetch_assoc();
        if ((int)$leaveRow['leave_days'] >= 15) $isExempt = 1;

        // Count votes used
        $vStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM employee_votes WHERE voter_id = ? AND month = ? AND year = ? AND company_id = ?");
        $vStmt->bind_param('siii', $empId, $month, $year, $company_id);
        $vStmt->execute();
        $votesUsed = (int)$vStmt->get_result()->fetch_assoc()['cnt'];

        // Count votes received
        $rStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM employee_votes WHERE voted_for_id = ? AND month = ? AND year = ? AND company_id = ?");
        $rStmt->bind_param('siii', $empId, $month, $year, $company_id);
        $rStmt->execute();
        $received = (int)$rStmt->get_result()->fetch_assoc()['cnt'];

        // Compute scores
        $participation = $votesUsed;       // +1 per vote cast
        $penalty = $MAX_VOTES - $votesUsed; // unused votes penalty
        if ($isExempt) {
            $participation = 0;
            $penalty = 0;
        }

        // Streak bonus: check previous STREAK_MONTHS-1 months
        $streakBonus = 0;
        if ($votesUsed >= $MAX_VOTES && !$isExempt) {
            $hasStreak = true;
            for ($i = 1; $i < $STREAK_MONTHS; $i++) {
                $prevM = $month - $i;
                $prevY = $year;
                if ($prevM <= 0) { $prevM += 12; $prevY--; }
                $sStmt = $conn->prepare("SELECT votes_used FROM employee_vote_scores WHERE employee_id = ? AND month = ? AND year = ? AND company_id = ?");
                $sStmt->bind_param('siii', $empId, $prevM, $prevY, $company_id);
                $sStmt->execute();
                $sRow = $sStmt->get_result()->fetch_assoc();
                if (!$sRow || (int)$sRow['votes_used'] < $MAX_VOTES) {
                    $hasStreak = false;
                    break;
                }
            }
            if ($hasStreak) $streakBonus = $STREAK_BONUS;
        }

        $total = $participation + $received - $penalty + $streakBonus;
        if ($total < 0) $total = 0; // Floor = 0

        // Upsert score
        $upsert = $conn->prepare(
            "INSERT INTO employee_vote_scores (company_id, employee_id, month, year, participation_score, received_score, penalty, streak_bonus, total_score, votes_used, is_exempt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE participation_score=VALUES(participation_score), received_score=VALUES(received_score),
                penalty=VALUES(penalty), streak_bonus=VALUES(streak_bonus), total_score=VALUES(total_score),
                votes_used=VALUES(votes_used), is_exempt=VALUES(is_exempt)"
        );
        $upsert->bind_param('isiiiiiiiii', $company_id, $empId, $month, $year,
            $participation, $received, $penalty, $streakBonus, $total, $votesUsed, $isExempt);
        $upsert->execute();
        $processed++;
    }

    json_response(['message' => "ปิดเดือน $month/$year สำเร็จ คำนวณ $processed พนักงาน"]);
}

json_response(['error' => 'Invalid action or method'], 405);
