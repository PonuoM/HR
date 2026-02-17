<?php
/**
 * Search Places via Nominatim (OpenStreetMap Geocoding)
 * GET /api/search_places.php?q=สนามบินสุวรรณภูมิ
 * 
 * Returns coordinate results for place name searches
 */
require_once __DIR__ . '/config.php';

$method = get_method();
if ($method !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

$query = $_GET['q'] ?? '';
if (!$query) {
    json_response(['error' => 'Query is required'], 400);
}

// Single fast Nominatim search with Thailand bias
$params = http_build_query([
    'format' => 'json',
    'q' => $query,
    'limit' => 5,
    'accept-language' => 'th,en',
    'addressdetails' => 1,
    'viewbox' => '97.3,20.5,105.6,5.6',
    'bounded' => 0,
]);

$url = 'https://nominatim.openstreetmap.org/search?' . $params;

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT => 'HRMobileConnect/1.0 (contact@example.com)',
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
]);

$response = curl_exec($ch);
$error = curl_error($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($error) {
    json_response(['error' => 'ค้นหาไม่สำเร็จ: ' . $error], 500);
}

$data = json_decode($response, true);

if (empty($data)) {
    json_response(['error' => 'ไม่พบสถานที่ ลองค้นหาด้วยคำอื่น หรือใช้ปุ่ม "เปิด Google Maps"'], 400);
}

// Format results
$results = [];
foreach (array_slice($data, 0, 5) as $r) {
    $results[] = [
        'name' => $r['display_name'] ?? $query,
        'latitude' => (float) $r['lat'],
        'longitude' => (float) $r['lon'],
        'type' => $r['type'] ?? '',
    ];
}

json_response([
    'results' => $results,
    'best' => $results[0],
]);
