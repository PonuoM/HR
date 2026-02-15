<?php
/**
 * Holidays API (Company Days Off)
 * GET    /api/holidays.php?year=2026       — List holidays for a year
 * GET    /api/holidays.php                 — List holidays for current year
 * POST   /api/holidays.php                 — Create holiday
 * PUT    /api/holidays.php?id=X            — Update holiday
 * DELETE /api/holidays.php?id=X            — Delete holiday
 * POST   /api/holidays.php?action=copy     — Copy holidays from one year to another
 */
require_once __DIR__ . '/config.php';

$method = get_method();

// ======================== GET ========================
if ($method === 'GET') {
    $year = isset($_GET['year']) ? intval($_GET['year']) : (int)date('Y');
    
    $stmt = $conn->prepare("SELECT id, date, name, year, created_at FROM holidays WHERE year = ? ORDER BY date ASC");
    $stmt->bind_param('i', $year);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['year'] = (int)$row['year'];
        $items[] = $row;
    }
    
    // Also return available years for the year selector
    $yearsResult = $conn->query("SELECT DISTINCT year FROM holidays ORDER BY year DESC");
    $years = [];
    while ($y = $yearsResult->fetch_assoc()) {
        $years[] = (int)$y['year'];
    }
    // Ensure current year and next year are always in the list
    $currentYear = (int)date('Y');
    if (!in_array($currentYear, $years)) $years[] = $currentYear;
    if (!in_array($currentYear + 1, $years)) $years[] = $currentYear + 1;
    rsort($years);
    
    json_response([
        'holidays' => $items,
        'year' => $year,
        'available_years' => $years,
        'total' => count($items),
    ]);
}

// ======================== POST (Create / Copy) ========================
if ($method === 'POST') {
    $action = $_GET['action'] ?? '';
    $body = get_json_body();
    
    // Copy holidays from one year to another
    if ($action === 'copy') {
        $fromYear = intval($body['from_year'] ?? 0);
        $toYear = intval($body['to_year'] ?? 0);
        
        if (!$fromYear || !$toYear || $fromYear === $toYear) {
            json_response(['error' => 'from_year and to_year are required and must be different'], 400);
        }
        
        // Get holidays from source year
        $stmt = $conn->prepare("SELECT date, name FROM holidays WHERE year = ? ORDER BY date");
        $stmt->bind_param('i', $fromYear);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $copied = 0;
        $yearDiff = $toYear - $fromYear;
        
        while ($row = $result->fetch_assoc()) {
            $oldDate = new DateTime($row['date']);
            $newDate = $oldDate->modify("+{$yearDiff} year")->format('Y-m-d');
            $name = $row['name'];
            
            // Check if already exists
            $checkStmt = $conn->prepare("SELECT id FROM holidays WHERE date = ? AND year = ?");
            $checkStmt->bind_param('si', $newDate, $toYear);
            $checkStmt->execute();
            if ($checkStmt->get_result()->num_rows === 0) {
                $insStmt = $conn->prepare("INSERT INTO holidays (date, name, year) VALUES (?, ?, ?)");
                $insStmt->bind_param('ssi', $newDate, $name, $toYear);
                $insStmt->execute();
                $copied++;
            }
        }
        
        json_response(['message' => "Copied $copied holidays from $fromYear to $toYear", 'copied' => $copied], 201);
    }
    
    // Create single holiday
    $date = $body['date'] ?? '';
    $name = $body['name'] ?? '';
    
    if (!$date || !$name) {
        json_response(['error' => 'date and name are required'], 400);
    }
    
    $year = (int)date('Y', strtotime($date));
    
    // Check duplicate
    $checkStmt = $conn->prepare("SELECT id FROM holidays WHERE date = ?");
    $checkStmt->bind_param('s', $date);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        json_response(['error' => 'วันหยุดวันนี้มีอยู่แล้ว'], 400);
    }
    
    $stmt = $conn->prepare("INSERT INTO holidays (date, name, year) VALUES (?, ?, ?)");
    $stmt->bind_param('ssi', $date, $name, $year);
    $stmt->execute();
    
    json_response(['id' => $conn->insert_id, 'message' => 'Holiday created'], 201);
}

// ======================== PUT (Update) ========================
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $body = json_decode(file_get_contents('php://input'), true);
    
    $date = $body['date'] ?? '';
    $name = $body['name'] ?? '';
    
    if (!$date || !$name) {
        json_response(['error' => 'date and name are required'], 400);
    }
    
    $year = (int)date('Y', strtotime($date));
    
    $stmt = $conn->prepare("UPDATE holidays SET date = ?, name = ?, year = ? WHERE id = ?");
    $stmt->bind_param('ssii', $date, $name, $year, $id);
    $stmt->execute();
    
    json_response(['message' => 'Holiday updated', 'id' => $id]);
}

// ======================== DELETE ========================
if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $conn->query("DELETE FROM holidays WHERE id = $id");
    json_response(['message' => 'Holiday deleted']);
}

json_response(['error' => 'Method not allowed'], 405);
