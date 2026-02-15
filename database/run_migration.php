<?php
require_once __DIR__ . '/../api/config.php';
$raw = file_get_contents(__DIR__ . '/20260215_approval_tracking.sql');
// Remove comments
$raw = preg_replace('/--.*$/m', '', $raw);
$statements = array_filter(array_map('trim', explode(';', $raw)));
$ok = 0;
$fail = 0;
foreach ($statements as $stmt) {
    if (empty($stmt)) continue;
    if ($conn->query($stmt)) {
        $ok++;
        echo "OK: " . substr($stmt, 0, 70) . "...\n";
    } else {
        $fail++;
        echo "ERR: " . $conn->error . " | " . substr($stmt, 0, 70) . "...\n";
    }
}
echo "\nDone: $ok success, $fail failed\n";
