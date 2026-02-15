<?php
/**
 * News Articles API
 * GET    /api/news.php       - List all (pinned first)
 * POST   /api/news.php       - Create article
 * PUT    /api/news.php?id=X  - Update article
 * DELETE /api/news.php?id=X  - Delete article
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method === 'GET') {
    $sql = "SELECT * FROM news_articles ORDER BY is_pinned DESC, published_at DESC";
    $result = $conn->query($sql);
    $articles = [];
    while ($row = $result->fetch_assoc()) {
        $row['is_pinned'] = (bool)$row['is_pinned'];
        $row['is_urgent'] = (bool)$row['is_urgent'];
        $articles[] = $row;
    }
    json_response($articles);
}

if ($method === 'POST') {
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

if ($method === 'PUT' && isset($_GET['id'])) {
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

if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $conn->query("DELETE FROM news_articles WHERE id = $id");
    json_response(['message' => 'Deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
