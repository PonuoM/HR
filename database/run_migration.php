<?php
/**
 * HR Mobile Connect — Database Migration Runner
 * 
 * รัน migrations ทั้งหมดผ่าน URL:
 *   https://hr.prima49.com/database/run_migration.php?key=prima49migrate
 * 
 * ต้องใส่ ?key=prima49migrate เพื่อป้องกันคนอื่นรันได้
 */

// --- Security: ต้องใส่ key ที่ถูกต้อง ---
$SECRET_KEY = 'prima49migrate';

if (!isset($_GET['key']) || $_GET['key'] !== $SECRET_KEY) {
    http_response_code(403);
    echo "<h2>❌ Access Denied</h2><p>ต้องใส่ <code>?key=prima49migrate</code> ใน URL</p>";
    exit;
}

// --- Config ---
require_once __DIR__ . '/../api/config.php';
header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html><html><head><meta charset='utf-8'><title>DB Migration</title>";
echo "<style>body{font-family:monospace;padding:20px;background:#1a1a2e;color:#e0e0e0}";
echo ".ok{color:#4ade80}.err{color:#f87171}.skip{color:#fbbf24}.info{color:#60a5fa}";
echo "h1{color:#818cf8}h2{color:#c084fc;margin-top:20px}hr{border-color:#333}</style></head><body>";
echo "<h1>🗄️ HR Mobile Connect — Migration Runner</h1><hr>";

// --- Find all .sql files in database/ ---
$sqlDir = __DIR__;
$files = glob($sqlDir . '/*.sql');
sort($files);

if (empty($files)) {
    echo "<p class='skip'>⚠️ ไม่พบไฟล์ .sql ในโฟลเดอร์ database/</p>";
    echo "</body></html>";
    exit;
}

$totalOk = 0;
$totalFail = 0;
$totalSkip = 0;

foreach ($files as $file) {
    $filename = basename($file);
    echo "<h2>📄 $filename</h2>";
    
    $raw = file_get_contents($file);
    // Remove comments
    $raw = preg_replace('/--.*$/m', '', $raw);
    $statements = array_filter(array_map('trim', explode(';', $raw)));
    
    if (empty($statements)) {
        echo "<p class='skip'>⏭️ ไม่มี statement</p>";
        $totalSkip++;
        continue;
    }
    
    $ok = 0;
    $fail = 0;
    
    foreach ($statements as $stmt) {
        if (empty($stmt)) continue;
        $preview = htmlspecialchars(substr($stmt, 0, 100));
        
        if ($conn->query($stmt)) {
            $ok++;
            echo "<p class='ok'>✅ $preview...</p>";
        } else {
            $errMsg = $conn->error;
            // "Duplicate column" or "already exists" = ข้ามได้ (migration รันแล้ว)
            if (
                stripos($errMsg, 'Duplicate column') !== false ||
                stripos($errMsg, 'already exists') !== false ||
                stripos($errMsg, 'Duplicate entry') !== false
            ) {
                echo "<p class='skip'>⏭️ (already exists) $preview...</p>";
                $totalSkip++;
            } else {
                $fail++;
                echo "<p class='err'>❌ $errMsg<br>&nbsp;&nbsp;&nbsp;$preview...</p>";
            }
        }
    }
    
    $totalOk += $ok;
    $totalFail += $fail;
}

echo "<hr>";
echo "<h2>📊 สรุปผล</h2>";
echo "<p class='ok'>✅ สำเร็จ: $totalOk</p>";
echo "<p class='skip'>⏭️ ข้าม (มีอยู่แล้ว): $totalSkip</p>";
echo "<p class='err'>❌ ล้มเหลว: $totalFail</p>";
echo "<br><p class='info'>🕐 " . date('Y-m-d H:i:s') . "</p>";
echo "</body></html>";
