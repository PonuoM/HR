<?php
/**
 * Resolve Google Maps URL → Extract Lat/Lng
 * GET /api/resolve_gmaps.php?url=https://maps.app.goo.gl/xxx
 * 
 * Supports:
 * - Short links: maps.app.goo.gl/xxx (desktop & mobile share)
 * - Full URLs: google.com/maps/place/.../@lat,lng,zoom/...
 * - Query params: ?q=lat,lng or ?ll=lat,lng
 * - Plus Codes & address extraction (mobile share fallback)
 */
require_once __DIR__ . '/config.php';

$method = get_method();

if ($method !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

$url = $_GET['url'] ?? '';

if (!$url) {
    json_response(['error' => 'URL is required'], 400);
}

// Validate that the URL is a Google Maps URL
if (!preg_match('/google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i', $url)) {
    json_response(['error' => 'ลิงก์ไม่ใช่ Google Maps'], 400);
}

// Helper to return coordinates
function coord_response($lat, $lng, $url) {
    json_response([
        'latitude' => (float) $lat,
        'longitude' => (float) $lng,
        'resolved_url' => $url,
    ]);
}

// Resolve short URL using cURL follow redirects
$resolved_url = $url;
$response_body = '';

if (preg_match('/goo\.gl/i', $url)) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $response_body = curl_exec($ch);
    $final_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        json_response(['error' => 'ไม่สามารถเปิดลิงก์ได้: ' . $error], 500);
    }

    if ($http_code >= 400) {
        json_response(['error' => 'ลิงก์ไม่ถูกต้องหรือหมดอายุ (HTTP ' . $http_code . ')'], 400);
    }

    $resolved_url = $final_url;
}

// Pattern 1: @lat,lng (most common — desktop links)
if (preg_match('/@(-?\d+\.?\d*),(-?\d+\.?\d*)/', $resolved_url, $matches)) {
    coord_response($matches[1], $matches[2], $resolved_url);
}

// Pattern 2: ?q=lat,lng or &q=lat,lng
if (preg_match('/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/', $resolved_url, $matches)) {
    coord_response($matches[1], $matches[2], $resolved_url);
}

// Pattern 3: ?ll=lat,lng or &ll=lat,lng or &sll=lat,lng
if (preg_match('/[?&]s?ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/', $resolved_url, $matches)) {
    coord_response($matches[1], $matches[2], $resolved_url);
}

// Pattern 4: !3dLAT!4dLNG (embedded maps)
if (preg_match('/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/', $resolved_url, $matches)) {
    coord_response($matches[1], $matches[2], $resolved_url);
}

// Pattern 5: Search response body for @lat,lng
if ($response_body) {
    if (preg_match('/@(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/', $response_body, $m)) {
        coord_response($m[1], $m[2], $resolved_url);
    }
    if (preg_match('/center=(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/', $response_body, $m)) {
        coord_response($m[1], $m[2], $resolved_url);
    }
}

// Pattern 6 (FALLBACK): Mobile links have /place/PLUSCODE+ADDRESS/data=...
// Extract address from URL and return it for client-side geocoding
$decoded_url = urldecode($resolved_url);
if (preg_match('/\/place\/(.+?)\/(data|@)/', $decoded_url, $pm)) {
    $place_text = $pm[1];
    // Remove Plus Code prefix
    $place_text = preg_replace('/[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,3}\s*/i', '', $place_text);
    // Clean up
    $place_text = str_replace('+', ' ', $place_text);
    $place_text = trim($place_text);
    
    if (strlen($place_text) > 3) {
        // Return the address for client-side geocoding
        json_response([
            'needs_geocoding' => true,
            'address' => $place_text,
            'resolved_url' => $resolved_url,
        ]);
    }
}

json_response(['error' => 'ไม่พบพิกัดในลิงก์นี้ กรุณาตรวจสอบลิงก์อีกครั้ง'], 400);
