<?php
/**
 * Uploads API — Centralized file upload system
 * POST   /api/uploads.php              - Upload a file
 * GET    /api/uploads.php?id=X         - Get file info
 * GET    /api/uploads.php?category=X   - List files by category
 * DELETE /api/uploads.php?id=X         - Delete a file
 */
require_once __DIR__ . '/config.php';

$method = get_method();
$uploadDir = __DIR__ . '/../uploads/';

// Ensure upload directory exists
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Build public URL base
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$basePath = dirname(dirname($_SERVER['SCRIPT_NAME']));
$baseUrl = $protocol . '://' . $host . $basePath . '/uploads/';

if ($method === 'POST') {
    if (!isset($_FILES['file'])) {
        json_response(['error' => 'No file uploaded'], 400);
    }

    $file = $_FILES['file'];
    $category = $_POST['category'] ?? 'general';
    $related_id = $_POST['related_id'] ?? null;
    $uploaded_by = $_POST['uploaded_by'] ?? null;

    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf'];
    if (!in_array($file['type'], $allowedTypes)) {
        json_response(['error' => 'File type not allowed: ' . $file['type']], 400);
    }

    // Max 5MB
    if ($file['size'] > 5 * 1024 * 1024) {
        json_response(['error' => 'File too large (max 5MB)'], 400);
    }

    // Generate unique filename
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = $category . '_' . uniqid() . '.' . $ext;

    // Move file
    $destPath = $uploadDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        json_response(['error' => 'Failed to save file'], 500);
    }

    // Save metadata to DB
    $originalName = $file['name'];
    $mimeType = $file['type'];
    $fileSize = $file['size'];

    $stmt = $conn->prepare("INSERT INTO uploads (filename, original_name, mime_type, file_size, category, related_id, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssisss', $filename, $originalName, $mimeType, $fileSize, $category, $related_id, $uploaded_by);
    $stmt->execute();

    $id = $conn->insert_id;
    $url = $baseUrl . $filename;

    json_response([
        'id' => $id,
        'url' => $url,
        'filename' => $filename,
        'original_name' => $originalName,
        'message' => 'Uploaded successfully'
    ], 201);
}

if ($method === 'GET') {
    // Single file by ID
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        $result = $conn->query("SELECT * FROM uploads WHERE id = $id");
        $row = $result->fetch_assoc();
        if (!$row) {
            json_response(['error' => 'Not found'], 404);
        }
        $row['url'] = $baseUrl . $row['filename'];
        json_response($row);
    }

    // List by category
    $category = $_GET['category'] ?? null;
    $related_id = $_GET['related_id'] ?? null;

    $sql = "SELECT * FROM uploads WHERE 1=1";
    if ($category) {
        $sql .= " AND category = '" . $conn->real_escape_string($category) . "'";
    }
    if ($related_id) {
        $sql .= " AND related_id = '" . $conn->real_escape_string($related_id) . "'";
    }
    $sql .= " ORDER BY created_at DESC";

    $result = $conn->query($sql);
    $files = [];
    while ($row = $result->fetch_assoc()) {
        $row['url'] = $baseUrl . $row['filename'];
        $files[] = $row;
    }
    json_response($files);
}

if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];

    // Get filename first
    $result = $conn->query("SELECT filename FROM uploads WHERE id = $id");
    $row = $result->fetch_assoc();
    if ($row) {
        $filePath = $uploadDir . $row['filename'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        $conn->query("DELETE FROM uploads WHERE id = $id");
        json_response(['message' => 'Deleted']);
    } else {
        json_response(['error' => 'Not found'], 404);
    }
}

json_response(['error' => 'Method not allowed'], 405);
