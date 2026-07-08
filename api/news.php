<?php
/**
 * News Articles API (Multi-Company)
 * GET    /api/news.php                          - List all (pinned first), with like counts + user like state
 * POST   /api/news.php                          - Create article
 * PUT    /api/news.php?id=X                     - Update article
 * DELETE /api/news.php?id=X                     - Delete article
 *
 * POST   /api/news.php?action=like&id=X         - Toggle like
 * GET    /api/news.php?action=comments&id=X     - Get comments for article
 * POST   /api/news.php?action=comment&id=X      - Add comment
 * DELETE /api/news.php?action=comment&id=X      - Delete comment (id = comment id)
 */
require_once __DIR__ . '/config.php';

$company_id = get_company_id();

// Auto-create supporting tables if they don't exist
$conn->query("CREATE TABLE IF NOT EXISTS `news_likes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `article_id` INT NOT NULL,
  `employee_id` VARCHAR(20) NOT NULL,
  `reaction_type` VARCHAR(10) NOT NULL DEFAULT 'like',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_article_employee` (`article_id`, `employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Auto-add reaction_type column if missing (migration)
$colCheck = $conn->query("SHOW COLUMNS FROM news_likes LIKE 'reaction_type'");
if ($colCheck && $colCheck->num_rows === 0) {
    $conn->query("ALTER TABLE news_likes ADD COLUMN `reaction_type` VARCHAR(10) NOT NULL DEFAULT 'like' AFTER `employee_id`");
}

// Auto-add category column to news_articles if missing
$colCheck2 = $conn->query("SHOW COLUMNS FROM news_articles LIKE 'category'");
if ($colCheck2 && $colCheck2->num_rows === 0) {
    $conn->query("ALTER TABLE news_articles ADD COLUMN `category` VARCHAR(50) DEFAULT 'ประกาศทั่วไป' AFTER `department_code`");
}

// Auto-modify image column to TEXT if it's currently varchar
$colCheck3 = $conn->query("SHOW COLUMNS FROM news_articles LIKE 'image'");
if ($colCheck3) {
    $col = $colCheck3->fetch_assoc();
    if (strpos(strtolower($col['Type']), 'varchar') !== false) {
        $conn->query("ALTER TABLE news_articles MODIFY COLUMN `image` TEXT");
    }
}

// Auto-add target_companies and target_departments columns to news_articles if missing
$colCheck4 = $conn->query("SHOW COLUMNS FROM news_articles LIKE 'target_companies'");
if ($colCheck4 && $colCheck4->num_rows === 0) {
    $conn->query("ALTER TABLE news_articles ADD COLUMN `target_companies` TEXT NULL AFTER `category`");
    $conn->query("ALTER TABLE news_articles ADD COLUMN `target_departments` TEXT NULL AFTER `target_companies`");
}

$conn->query("CREATE TABLE IF NOT EXISTS `news_comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `article_id` INT NOT NULL,
  `employee_id` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$conn->query("CREATE TABLE IF NOT EXISTS `news_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_company_name` (`company_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$catCheck = $conn->query("SELECT COUNT(*) as cnt FROM news_categories WHERE company_id=$company_id")->fetch_assoc();
if ($catCheck && $catCheck['cnt'] == 0) {
    $defaults = ['ประกาศทั่วไป', 'ข่าวประชาสัมพันธ์', 'กิจกรรม', 'นโยบายและสวัสดิการ', 'ประกาศวันหยุด', 'อื่นๆ'];
    $stmt = $conn->prepare("INSERT INTO news_categories (company_id, name) VALUES (?, ?)");
    foreach ($defaults as $name) {
        $stmt->bind_param('is', $company_id, $name);
        $stmt->execute();
    }
}

$method = get_method();
$action = $_GET['action'] ?? null;

// ---- CATEGORIES ----
if ($action === 'categories') {
    if ($method === 'GET') {
        $res = $conn->query("SELECT id, name FROM news_categories WHERE company_id=$company_id ORDER BY id ASC");
        $cats = [];
        while ($row = $res->fetch_assoc()) $cats[] = $row;
        json_response($cats);
    }
    if ($method === 'POST') {
        require_admin($conn);
        $body = get_json_body();
        $name = trim($body['name'] ?? '');
        if (!$name) json_response(['error' => 'Name is required'], 400);
        $stmt = $conn->prepare("INSERT IGNORE INTO news_categories (company_id, name) VALUES (?, ?)");
        $stmt->bind_param('is', $company_id, $name);
        $stmt->execute();
        json_response(['id' => $conn->insert_id, 'name' => $name, 'message' => 'Created'], 201);
    }
    if ($method === 'DELETE' && isset($_GET['id'])) {
        require_admin($conn);
        $id = (int)$_GET['id'];
        $stmt = $conn->prepare("DELETE FROM news_categories WHERE id=? AND company_id=?");
        $stmt->bind_param('ii', $id, $company_id);
        $stmt->execute();
        json_response(['message' => 'Deleted']);
    }
}

if ($action === 'latest_id' && $method === 'GET') {
    $employeeId = $_GET['employee_id'] ?? null;
    $compFilter = "(a.target_companies IS NULL OR a.target_companies = 'all' OR JSON_CONTAINS(a.target_companies, '" . $company_id . "', '$') OR a.company_id = $company_id)";
    $deptFilter = "1=1";
    
    if ($employeeId) {
        $emp = $conn->query("SELECT department_id FROM employees WHERE id = '" . $conn->real_escape_string($employeeId) . "'")->fetch_assoc();
        $employeeDepartmentId = $emp ? $emp['department_id'] : null;
        if ($employeeDepartmentId) {
            $deptFilter = "(a.target_departments IS NULL OR a.target_departments = 'all' OR JSON_CONTAINS(a.target_departments, '" . $employeeDepartmentId . "', '$'))";
        }
    }

    $res = $conn->query("SELECT MAX(a.id) as max_id FROM news_articles a WHERE $compFilter AND $deptFilter");
    $row = $res->fetch_assoc();
    $globalMax = $row['max_id'] ? (int)$row['max_id'] : 0;
    
    $cats = $conn->query("SELECT IFNULL(a.category, 'ประกาศทั่วไป') as cat_name, MAX(a.id) as max_id FROM news_articles a WHERE $compFilter AND $deptFilter GROUP BY IFNULL(a.category, 'ประกาศทั่วไป')");
    $catLatest = [];
    if ($cats) {
        while($r = $cats->fetch_assoc()) {
            $catLatest[$r['cat_name']] = (int)$r['max_id'];
        }
    }
    
    json_response(['latest_id' => $globalMax, 'categories' => $catLatest]);
}

// ---- LIKES / REACTIONS ----
if ($action === 'like' && $method === 'POST' && isset($_GET['id'])) {
    $articleId = (int)$_GET['id'];
    $body = get_json_body();
    $employeeId = $body['employee_id'] ?? '';
    $reactionType = $body['reaction_type'] ?? 'like';
    $allowedTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
    if (!in_array($reactionType, $allowedTypes)) $reactionType = 'like';
    if (!$employeeId) json_response(['error' => 'employee_id required'], 400);

    // Check if already reacted
    $check = $conn->prepare("SELECT id, reaction_type FROM news_likes WHERE article_id=? AND employee_id=?");
    $check->bind_param('is', $articleId, $employeeId);
    $check->execute();
    $existing = $check->get_result()->fetch_assoc();

    if ($existing) {
        if ($existing['reaction_type'] === $reactionType) {
            // Same reaction → remove (unlike)
            $del = $conn->prepare("DELETE FROM news_likes WHERE article_id=? AND employee_id=?");
            $del->bind_param('is', $articleId, $employeeId);
            $del->execute();
            $conn->query("UPDATE news_articles SET likes = (SELECT COUNT(*) FROM news_likes WHERE article_id=$articleId) WHERE id=$articleId");
            json_response(['liked' => false, 'reaction_type' => null, 'message' => 'Removed reaction']);
        } else {
            // Different reaction → update
            $upd = $conn->prepare("UPDATE news_likes SET reaction_type=? WHERE article_id=? AND employee_id=?");
            $upd->bind_param('sis', $reactionType, $articleId, $employeeId);
            $upd->execute();
            json_response(['liked' => true, 'reaction_type' => $reactionType, 'message' => 'Reaction updated']);
        }
    } else {
        // New reaction
        $ins = $conn->prepare("INSERT INTO news_likes (article_id, employee_id, reaction_type) VALUES (?, ?, ?)");
        $ins->bind_param('iss', $articleId, $employeeId, $reactionType);
        $ins->execute();
        $conn->query("UPDATE news_articles SET likes = (SELECT COUNT(*) FROM news_likes WHERE article_id=$articleId) WHERE id=$articleId");
        json_response(['liked' => true, 'reaction_type' => $reactionType, 'message' => 'Reacted']);
    }
}

// ---- COMMENTS: GET ----
if ($action === 'comments' && $method === 'GET' && isset($_GET['id'])) {
    $articleId = (int)$_GET['id'];
    $stmt = $conn->prepare("SELECT c.id, c.content, c.employee_id, CONCAT(e.name, IF(IFNULL(e.nickname, '') != '', CONCAT(' (', e.nickname, ')'), '')) AS employee_name, e.avatar, c.created_at
        FROM news_comments c
        LEFT JOIN employees e ON e.id = c.employee_id
        WHERE c.article_id = ?
        ORDER BY c.created_at ASC");
    $stmt->bind_param('i', $articleId);
    $stmt->execute();
    $result = $stmt->get_result();
    $comments = [];
    while ($row = $result->fetch_assoc()) {
        $comments[] = $row;
    }
    json_response($comments);
}

// ---- COMMENTS: POST ----
if ($action === 'comment' && $method === 'POST' && isset($_GET['id'])) {
    $articleId = (int)$_GET['id'];
    $body = get_json_body();
    $employeeId = $body['employee_id'] ?? '';
    $content = $body['content'] ?? '';
    if (!$employeeId || !$content) json_response(['error' => 'employee_id and content required'], 400);

    $ins = $conn->prepare("INSERT INTO news_comments (article_id, employee_id, content) VALUES (?, ?, ?)");
    $ins->bind_param('iss', $articleId, $employeeId, $content);
    $ins->execute();
    // Update comments count
    $conn->query("UPDATE news_articles SET comments_count = (SELECT COUNT(*) FROM news_comments WHERE article_id=$articleId) WHERE id=$articleId");
    json_response(['id' => $conn->insert_id, 'message' => 'Comment added'], 201);
}

// ---- COMMENTS: DELETE ----
if ($action === 'comment' && $method === 'DELETE' && isset($_GET['id'])) {
    $commentId = (int)$_GET['id'];
    // Get article_id before delete
    $row = $conn->query("SELECT article_id FROM news_comments WHERE id=$commentId")->fetch_assoc();
    $conn->query("DELETE FROM news_comments WHERE id=$commentId");
    if ($row) {
        $aid = $row['article_id'];
        $conn->query("UPDATE news_articles SET comments_count = (SELECT COUNT(*) FROM news_comments WHERE article_id=$aid) WHERE id=$aid");
    }
    json_response(['message' => 'Comment deleted']);
}

// ---- LIST (with user's liked state) ----
if ($method === 'GET' && !$action) {
    $employeeId = $_GET['employee_id'] ?? null;
    
    $compFilter = "(a.target_companies IS NULL OR a.target_companies = 'all' OR JSON_CONTAINS(a.target_companies, '" . $company_id . "', '$') OR a.company_id = $company_id)";
    $deptFilter = "1=1";
    
    if ($employeeId) {
        $emp = $conn->query("SELECT department_id FROM employees WHERE id = '" . $conn->real_escape_string($employeeId) . "'")->fetch_assoc();
        $employeeDepartmentId = $emp ? $emp['department_id'] : null;
        if ($employeeDepartmentId) {
            $deptFilter = "(a.target_departments IS NULL OR a.target_departments = 'all' OR JSON_CONTAINS(a.target_departments, '" . $employeeDepartmentId . "', '$'))";
        }
    }
    
    $sql = "SELECT a.*,
        (SELECT COUNT(*) FROM news_likes WHERE article_id = a.id) as like_count,
        (SELECT COUNT(*) FROM news_comments WHERE article_id = a.id) as comment_count"
        . ($employeeId ? ", (SELECT reaction_type FROM news_likes WHERE article_id = a.id AND employee_id = '" . $conn->real_escape_string($employeeId) . "' LIMIT 1) as user_reaction" : ", NULL as user_reaction")
        . " FROM news_articles a WHERE $compFilter AND $deptFilter ORDER BY a.is_pinned DESC, a.published_at DESC";
    $result = $conn->query($sql);
    $articles = [];
    while ($row = $result->fetch_assoc()) {
        $row['is_pinned'] = (bool)$row['is_pinned'];
        $row['is_urgent'] = (bool)$row['is_urgent'];
        $row['likes'] = (int)$row['like_count'];
        $row['comments'] = (int)$row['comment_count'];
        $row['user_liked'] = !empty($row['user_reaction']);
        // Reaction summary: count per type
        $aid = (int)$row['id'];
        $rq = $conn->query("SELECT reaction_type, COUNT(*) as cnt FROM news_likes WHERE article_id=$aid GROUP BY reaction_type ORDER BY cnt DESC");
        $summary = [];
        if ($rq) {
            while ($rr = $rq->fetch_assoc()) {
                $summary[$rr['reaction_type']] = (int)$rr['cnt'];
            }
        }
        $row['reaction_summary'] = $summary;
        unset($row['like_count'], $row['comment_count']);
        $articles[] = $row;
    }
    json_response($articles);
}

// ---- CREATE ----
if ($method === 'POST' && !$action) {
    require_admin($conn);
    $body = get_json_body();
    
    $target_companies = isset($body['target_companies']) && $body['target_companies'] !== 'all' ? json_encode($body['target_companies']) : 'all';
    $target_departments = isset($body['target_departments']) && $body['target_departments'] !== 'all' ? json_encode($body['target_departments']) : 'all';
    
    $stmt = $conn->prepare("INSERT INTO news_articles (company_id, title, content, image, department, department_code, category, is_pinned, is_urgent, target_companies, target_departments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('issssssisss',
        $company_id,
        $body['title'], $body['content'], $body['image'],
        $body['department'], $body['department_code'], $body['category'],
        $body['is_pinned'], $body['is_urgent'],
        $target_companies, $target_departments
    );
    $stmt->execute();
    json_response(['id' => $conn->insert_id, 'message' => 'Created'], 201);
}

// ---- UPDATE ----
if ($method === 'PUT' && !$action) {
    require_admin($conn);
    $id = (int)$_GET['id'];
    $body = get_json_body();
    
    $target_companies = isset($body['target_companies']) && $body['target_companies'] !== 'all' ? json_encode($body['target_companies']) : 'all';
    $target_departments = isset($body['target_departments']) && $body['target_departments'] !== 'all' ? json_encode($body['target_departments']) : 'all';
    
    $stmt = $conn->prepare("UPDATE news_articles SET title=?, content=?, image=?, department=?, department_code=?, category=?, is_pinned=?, is_urgent=?, target_companies=?, target_departments=? WHERE id=? AND company_id=?");
    $stmt->bind_param('ssssssisssii',
        $body['title'], $body['content'], $body['image'],
        $body['department'], $body['department_code'], $body['category'],
        $body['is_pinned'], $body['is_urgent'],
        $target_companies, $target_departments,
        $id, $company_id
    );
    $stmt->execute();
    json_response(['message' => 'Updated']);
}

// ---- DELETE ----
if ($method === 'DELETE' && isset($_GET['id']) && !$action) {
    require_admin($conn);
    $id = (int)$_GET['id'];
    $stmt = $conn->prepare("DELETE FROM news_articles WHERE id = ? AND company_id = ?");
    $stmt->bind_param('ii', $id, $company_id);
    $stmt->execute();
    json_response(['message' => 'Deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
