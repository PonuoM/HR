<?php
/**
 * Geocode Proxy — forwards requests to Nominatim via server-side cURL
 * Avoids CORS issues when calling Nominatim from the browser
 * 
 * GET /api/geocode.php?q=ลำลูกกา+ปทุมธานี&limit=5
 */
require_once __DIR__ . '/config.php';

$method = get_method();
if ($method !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

$query = $_GET['q'] ?? '';
if (!$query) {
    json_response([], 200); // Return empty array
}

$params = http_build_query([
    'format' => 'json',
    'q' => $query,
    'limit' => $_GET['limit'] ?? 5,
    'accept-language' => $_GET['accept-language'] ?? 'th,en',
    'countrycodes' => $_GET['countrycodes'] ?? '',
    'addressdetails' => 1,
]);

$url = 'https://nominatim.openstreetmap.org/search?' . $params;

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT => 'HRMobileConnect/1.0 (hr.prima49.com)',
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
]);

$response = curl_exec($ch);
$error = curl_error($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($error) {
    // If Nominatim is unreachable, return empty results
    json_response([]);
    exit;
}

// Pass through Nominatim's JSON response directly
header('Content-Type: application/json; charset=utf-8');
echo $response ?: '[]';
exit;
