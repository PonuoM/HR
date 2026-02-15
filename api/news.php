<?php
/**
 * News Articles API
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

// Auto-create supporting tables if they don't exist
$conn->query("CREATE TABLE IF NOT EXISTS `news_likes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `article_id` INT NOT NULL,
  `employee_id` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_article_employee` (`article_id`, `employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$conn->query("CREATE TABLE IF NOT EXISTS `news_comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `article_id` INT NOT NULL,
  `employee_id` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$method = get_method();
$action = $_GET['action'] ?? null;

// ---- LIKES ----
if ($action === 'like' && $method === 'POST' && isset($_GET['id'])) {
    $articleId = (int)$_GET['id'];
    $body = get_json_body();
    $employeeId = $body['employee_id'] ?? '';
    if (!$employeeId) json_response(['error' => 'employee_id required'], 400);

    // Check if already liked
    $check = $conn->prepare("SELECT id FROM news_likes WHERE article_id=? AND employee_id=?");
    $check->bind_param('is', $articleId, $employeeId);
    $check->execute();
    $existing = $check->get_result()->fetch_assoc();

    if ($existing) {
        // Unlike
        $del = $conn->prepare("DELETE FROM news_likes WHERE article_id=? AND employee_id=?");
        $del->bind_param('is', $articleId, $employeeId);
        $del->execute();
        // Update count
        $conn->query("UPDATE news_articles SET likes = (SELECT COUNT(*) FROM news_likes WHERE article_id=$articleId) WHERE id=$articleId");
        json_response(['liked' => false, 'message' => 'Unliked']);
    } else {
        // Like
        $ins = $conn->prepare("INSERT INTO news_likes (article_id, employee_id) VALUES (?, ?)");
        $ins->bind_param('is', $articleId, $employeeId);
        $ins->execute();
        // Update count
        $conn->query("UPDATE news_articles SET likes = (SELECT COUNT(*) FROM news_likes WHERE article_id=$articleId) WHERE id=$articleId");
        json_response(['liked' => true, 'message' => 'Liked']);
    }
}

// ---- COMMENTS: GET ----
if ($action === 'comments' && $method === 'GET' && isset($_GET['id'])) {
    $articleId = (int)$_GET['id'];
    $stmt = $conn->prepare("SELECT c.id, c.content, c.employee_id, e.name AS employee_name, e.avatar, c.created_at
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
    $sql = "SELECT a.*,
        (SELECT COUNT(*) FROM news_likes WHERE article_id = a.id) as like_count,
        (SELECT COUNT(*) FROM news_comments WHERE article_id = a.id) as comment_count"
        . ($employeeId ? ", (SELECT COUNT(*) FROM news_likes WHERE article_id = a.id AND employee_id = '" . $conn->real_escape_string($employeeId) . "') as user_liked" : ", 0 as user_liked")
        . " FROM news_articles a ORDER BY a.is_pinned DESC, a.published_at DESC";
    $result = $conn->query($sql);
    $articles = [];
    while ($row = $result->fetch_assoc()) {
        $row['is_pinned'] = (bool)$row['is_pinned'];
        $row['is_urgent'] = (bool)$row['is_urgent'];
        $row['likes'] = (int)$row['like_count'];
        $row['comments'] = (int)$row['comment_count'];
        $row['user_liked'] = (bool)(int)$row['user_liked'];
        unset($row['like_count'], $row['comment_count']);
        $articles[] = $row;
    }
    json_response($articles);
}

// ---- CREATE ----
if ($method === 'POST' && !$action) {
    $body = get_json_body();
    $stmt = $conn->prepare("INSERT INTO news_articles (title, content, image, department, department_code, is_pinned, is_urgent) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssssii',
        $body['title'], $body['content'], $body['image'],
        $body['department'], $body['department_code'],
        $body['is_pinned'], $body['is_urgent']
    );
    $stmt->execute();
    json_response(['id' => $conn->insert_id, 'message' => 'Created'], 201);
}

// ---- UPDATE ----
if ($method === 'PUT' && isset($_GET['id']) && !$action) {
    $id = (int)$_GET['id'];
    $body = get_json_body();
    $stmt = $conn->prepare("UPDATE news_articles SET title=?, content=?, image=?, department=?, department_code=?, is_pinned=?, is_urgent=? WHERE id=?");
    $stmt->bind_param('sssssiii',
        $body['title'], $body['content'], $body['image'],
        $body['department'], $body['department_code'],
        $body['is_pinned'], $body['is_urgent'], $id
    );
    $stmt->execute();
    json_response(['message' => 'Updated']);
}

// ---- DELETE ----
if ($method === 'DELETE' && isset($_GET['id']) && !$action) {
    $id = (int)$_GET['id'];
    $conn->query("DELETE FROM news_articles WHERE id = $id");
    json_response(['message' => 'Deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
