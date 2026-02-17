<?php
/**
 * Attendance API (GPS-enabled)
 * GET  /api/attendance.php?employee_id=X          - Get today's attendance + status
 * POST /api/attendance.php                         - Clock in (with GPS)
 * PUT  /api/attendance.php?id=X                    - Clock out (with GPS)
 */
require_once __DIR__ . '/config.php';

/**
 * Calculate distance between two GPS points using Haversine formula.
 * Returns distance in meters.
 */
function haversineDistance($lat1, $lng1, $lat2, $lng2) {
    $earthRadius = 6371000; // meters
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) * sin($dLat / 2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLng / 2) * sin($dLng / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $earthRadius * $c;
}

/**
 * Check if coordinates are within any active work location for this company.
 * Returns ['matched' => bool, 'location_name' => string, 'distance' => float]
 */
function checkWorkLocation($conn, $lat, $lng, $company_id) {
    $stmt = $conn->prepare("SELECT * FROM work_locations WHERE is_active = 1 AND company_id = ?");
    $stmt->bind_param('i', $company_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $closest = null;
    $closestDist = PHP_FLOAT_MAX;

    while ($loc = $result->fetch_assoc()) {
        $dist = haversineDistance($lat, $lng, (float)$loc['latitude'], (float)$loc['longitude']);
        if ($dist < $closestDist) {
            $closestDist = $dist;
            $closest = $loc;
        }
        if ($dist <= (int)$loc['radius_meters']) {
            return [
                'matched' => true,
                'location_name' => $loc['name'],
                'distance' => round($dist),
            ];
        }
    }

    return [
        'matched' => false,
        'location_name' => $closest ? $closest['name'] : 'ไม่พบสถานที่',
        'distance' => round($closestDist),
    ];
}

$method = get_method();
$company_id = get_company_id();

// ─── GET ?action=check_location: Pre-check GPS before clock-in ───
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'check_location') {
    $lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
    $lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;

    if ($lat === null || $lng === null) {
        json_response(['error' => 'lat and lng are required'], 400);
    }

    $locCheck = checkWorkLocation($conn, $lat, $lng, $company_id);
    json_response([
        'matched' => $locCheck['matched'],
        'location_name' => $locCheck['location_name'],
        'distance' => $locCheck['distance'],
    ]);
}

// ─── GET: Today's attendance + clock status ───
if ($method === 'GET') {
    $employee_id = $conn->real_escape_string($_GET['employee_id'] ?? 'EMP001');
    $date = $conn->real_escape_string($_GET['date'] ?? date('Y-m-d'));

    // Get today's attendance
    $sql = "SELECT * FROM attendance WHERE employee_id = '$employee_id' AND date = '$date'";
    $result = $conn->query($sql);
    $today = $result->fetch_assoc();

    // Get last checkout (most recent clock_out)
    $sql2 = "SELECT date, clock_out FROM attendance WHERE employee_id = '$employee_id' AND clock_out IS NOT NULL ORDER BY date DESC LIMIT 1";
    $result2 = $conn->query($sql2);
    $lastCheckout = $result2->fetch_assoc();

    // Determine clock status for the UI
    $clockStatus = 'not_clocked_in'; // default
    if ($today) {
        if ($today['clock_in'] && !$today['clock_out']) {
            $clockStatus = 'clocked_in'; // waiting for clock out
        } elseif ($today['clock_in'] && $today['clock_out']) {
            $clockStatus = 'completed'; // done for the day
        }
    }

    json_response([
        'today' => $today,
        'lastCheckout' => $lastCheckout,
        'clockStatus' => $clockStatus,
    ]);
}

// ─── POST: Clock in with GPS ───
if ($method === 'POST') {
    $body = get_json_body();
    $employee_id = $conn->real_escape_string($body['employee_id'] ?? '');
    $lat = isset($body['latitude']) ? (float)$body['latitude'] : null;
    $lng = isset($body['longitude']) ? (float)$body['longitude'] : null;
    $date = date('Y-m-d');
    $time = date('H:i:s');

    if (!$employee_id) {
        json_response(['error' => 'employee_id is required'], 400);
    }

    // Check if already clocked in today
    $check = $conn->query("SELECT id, clock_in, clock_out FROM attendance WHERE employee_id = '$employee_id' AND date = '$date'");
    if ($row = $check->fetch_assoc()) {
        if ($row['clock_in'] && !$row['clock_out']) {
            json_response(['error' => 'Already clocked in today. Please clock out first.'], 409);
        }
        if ($row['clock_in'] && $row['clock_out']) {
            json_response(['error' => 'Already completed clock in/out today.'], 409);
        }
    }

    // Check GPS location
    $is_offsite = 0;
    $location_name = 'ไม่ระบุตำแหน่ง';
    $location_text = 'ไม่ระบุ';

    if ($lat !== null && $lng !== null) {
        $locCheck = checkWorkLocation($conn, $lat, $lng, $company_id);
        $is_offsite = $locCheck['matched'] ? 0 : 1;
        $location_name = $locCheck['location_name'];
        $location_text = $locCheck['matched']
            ? $locCheck['location_name']
            : 'ต่างสถานที่ (ห่าง ' . $locCheck['distance'] . 'm จาก ' . $locCheck['location_name'] . ')';

        // Block offsite clock-in
        if ($is_offsite) {
            json_response([
                'error' => 'ไม่สามารถลงเวลาได้ เนื่องจากอยู่นอกพื้นที่ทำงาน (ห่าง ' . $locCheck['distance'] . ' เมตร จาก ' . $locCheck['location_name'] . ')',
                'distance' => $locCheck['distance'],
                'location_name' => $locCheck['location_name'],
            ], 403);
        }
    }

    $stmt = $conn->prepare(
        "INSERT INTO attendance (employee_id, date, clock_in, location, latitude, longitude, is_offsite, location_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE clock_in = VALUES(clock_in), location = VALUES(location),
            latitude = VALUES(latitude), longitude = VALUES(longitude),
            is_offsite = VALUES(is_offsite), location_name = VALUES(location_name)"
    );
    $stmt->bind_param('ssssddis',
        $employee_id, $date, $time, $location_text,
        $lat, $lng, $is_offsite, $location_name
    );
    $stmt->execute();

    json_response([
        'message' => 'Clocked in',
        'time' => $time,
        'location' => $location_text,
        'is_offsite' => (bool)$is_offsite,
        'location_name' => $location_name,
    ]);
}

// ─── PUT: Clock out with GPS ───
if ($method === 'PUT' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $body = get_json_body();
    $lat = isset($body['latitude']) ? (float)$body['latitude'] : null;
    $lng = isset($body['longitude']) ? (float)$body['longitude'] : null;
    $time = date('H:i:s');

    if ($lat !== null && $lng !== null) {
        $stmt = $conn->prepare("UPDATE attendance SET clock_out = ?, clock_out_latitude = ?, clock_out_longitude = ? WHERE id = ?");
        $stmt->bind_param('sddi', $time, $lat, $lng, $id);
    } else {
        $stmt = $conn->prepare("UPDATE attendance SET clock_out = ? WHERE id = ?");
        $stmt->bind_param('si', $time, $id);
    }
    $stmt->execute();

    json_response(['message' => 'Clocked out', 'time' => $time]);
}

json_response(['error' => 'Method not allowed'], 405);
