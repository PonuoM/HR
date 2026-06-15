<?php
/**
 * HR Attendance — Per-employee daily PDF (vector text via mPDF)
 *
 * GET /api/attendance_pdf.php?employee_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 * GET /api/attendance_pdf.php?employee_id=X&month=YYYY-MM
 * GET /api/attendance_pdf.php?employee_id=X&cutoff_month=YYYY-MM
 *
 * Output: application/pdf — direct download.
 * Uses Sarabun (traditional Thai font with loops) embedded in the PDF.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/schedule_helper.php';
require_once __DIR__ . '/lib/vendor/autoload.php';

$method = get_method();
if ($method !== 'GET') {
    http_response_code(405);
    exit('Method not allowed');
}

$company_id = get_company_id();

// ─── Params ───
$employee_id = $_GET['employee_id'] ?? null;
$month = $_GET['month'] ?? null;
$cutoff_month = $_GET['cutoff_month'] ?? null;
$date_from = $_GET['date_from'] ?? null;
$date_to = $_GET['date_to'] ?? null;

if (!$employee_id) {
    http_response_code(400);
    exit('employee_id is required');
}
if (!$month && !$cutoff_month && !($date_from && $date_to)) {
    http_response_code(400);
    exit('month, cutoff_month, or date_from+date_to is required');
}

// Resolve date range
if ($date_from && $date_to) {
    $startDate = $date_from;
    $endDate = $date_to;
} elseif ($cutoff_month) {
    $endDate = $cutoff_month . '-20';
    $prevDt = new DateTime($cutoff_month . '-01');
    $prevDt->modify('-1 month');
    $startDate = $prevDt->format('Y-m') . '-21';
} else {
    $startDate = $month . '-01';
    $endDate = date('Y-m-t', strtotime($startDate));
}

// ─── Fetch employee meta ───
$empStmt = $conn->prepare("SELECT e.id, e.name, e.department_id, e.hire_date, e.schedule_json, e.late_grace_minutes,
                                  d.name AS department, d.work_start_time, d.work_end_time,
                                  d.schedule_json AS dept_schedule_json,
                                  d.late_grace_minutes AS dept_late_grace_minutes,
                                  d.work_start_time AS dept_work_start_time,
                                  d.work_end_time AS dept_work_end_time
                           FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?");
$empStmt->bind_param('s', $employee_id);
$empStmt->execute();
$emp = $empStmt->get_result()->fetch_assoc();
if (!$emp) {
    http_response_code(404);
    exit('Employee not found');
}

$workStart = $emp['work_start_time'] ?? '09:00:00';
$workEnd = $emp['work_end_time'] ?? '17:00:00';
$empHireDate = $emp['hire_date'] ?? null;

// ─── Attendance rows ───
$attMap = [];
$attStmt = $conn->prepare("SELECT date, clock_in, clock_out, admin_note FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?");
$attStmt->bind_param('sss', $employee_id, $startDate, $endDate);
$attStmt->execute();
$attRes = $attStmt->get_result();
while ($a = $attRes->fetch_assoc()) {
    $attMap[$a['date']] = $a;
}

// ─── OT entries ───
$otByDate = [];
$otStmt = $conn->prepare(
    "SELECT id, start_date, end_date, total_days AS hours, ot_rate, reason
     FROM leave_requests
     WHERE employee_id = ?
       AND reason LIKE '[OT]%'
       AND DATE(start_date) BETWEEN ? AND ?"
);
$otStmt->bind_param('sss', $employee_id, $startDate, $endDate);
$otStmt->execute();
$otRes = $otStmt->get_result();
while ($ot = $otRes->fetch_assoc()) {
    $sDt = new DateTime($ot['start_date']);
    $eDt = new DateTime($ot['end_date']);
    $dateKey = $sDt->format('Y-m-d');
    $cleanReason = preg_replace('/^\[OT\]\s*/', '', $ot['reason']);
    $otByDate[$dateKey][] = [
        'start_time' => $sDt->format('H:i'),
        'end_time' => $eDt->format('H:i'),
        'hours' => (float)$ot['hours'],
        'ot_rate' => $ot['ot_rate'] !== null ? (float)$ot['ot_rate'] : 1.0,
        'reason' => $cleanReason,
    ];
}

// ─── Holidays ───
$holidayMap = [];
$hStmt = $conn->prepare("SELECT date, name FROM holidays WHERE company_id = ? AND date BETWEEN ? AND ?");
$hStmt->bind_param('iss', $company_id, $startDate, $endDate);
$hStmt->execute();
$hRes = $hStmt->get_result();
while ($h = $hRes->fetch_assoc()) {
    $holidayMap[$h['date']] = $h['name'];
}

// ─── Approved leaves (non-OT) ───
$leaveMap = [];
$lvStmt = $conn->prepare(
    "SELECT lr.start_date, lr.end_date, lt.name AS leave_type_name
     FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.employee_id = ? AND lr.status = 'approved'
       AND ((lr.start_date BETWEEN ? AND ?) OR (lr.end_date BETWEEN ? AND ?))"
);
$lvStmt->bind_param('sssss', $employee_id, $startDate, $endDate, $startDate, $endDate);
$lvStmt->execute();
$lvRes = $lvStmt->get_result();
while ($lv = $lvRes->fetch_assoc()) {
    $cur = new DateTime(max($lv['start_date'], $startDate));
    $lvEnd = new DateTime(min($lv['end_date'], $endDate));
    while ($cur <= $lvEnd) {
        $d = $cur->format('Y-m-d');
        $leaveMap[$d] = $lv['leave_type_name'];
        $cur->modify('+1 day');
    }
}

// ─── Build daily rows + stats ───
$days = [];
$cntPresent = 0; $cntLate = 0; $cntAbsent = 0; $cntLeave = 0; $totalLateMin = 0;
$otTotal = ['1.0' => 0, '1.5' => 0, '2.0' => 0, '3.0' => 0];
$otRawHours = 0;

$current = new DateTime($startDate);
$endDt = new DateTime($endDate);
$today = date('Y-m-d');
$dowNames = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

// Extra-working-day overrides (วันทำงานพิเศษ) for the period
$workIdx = fetch_workday_index($conn, $company_id, $startDate, $endDate);

while ($current <= $endDt) {
    $dateStr = $current->format('Y-m-d');
    $dow = (int)$current->format('N');
    $att = $attMap[$dateStr] ?? null;
    $sched = resolve_schedule_for_date($emp, $dateStr, $workIdx);

    $clockIn = $att['clock_in'] ?? null;
    $clockOut = $att['clock_out'] ?? null;
    $adminNote = $att['admin_note'] ?? null;
    $lateMin = 0;
    $leaveType = $leaveMap[$dateStr] ?? null;
    $holidayName = $holidayMap[$dateStr] ?? null;
    $status = '';

    // Records-driven precedence: leave/attendance surface even on off-schedule days;
    // off-schedule + no record stays "weekend" (never falsely "absent").
    if ($holidayName)                    $status = 'holiday';
    elseif ($leaveType)                  $status = 'leave';
    elseif ($att && $clockIn) {
        if (!$sched['active']) {
            $status = 'offday_work'; // off-schedule day worked → OT candidate
        } else {
            [$lateFlag, $lm] = is_late($clockIn, $sched);
            $lateMin = $lm;
            $status = $lateFlag ? 'late' : 'present';
        }
    }
    elseif (!$sched['active'])           $status = 'weekend';
    elseif ($empHireDate && $dateStr < $empHireDate) $status = 'pre_hire';
    elseif ($dateStr <= $today)          $status = 'absent';
    else                                  $status = 'future';

    $workHours = 0;
    if ($clockIn && $clockOut) {
        // Effective hours on scheduled days, raw on off-schedule worked days
        $workHours = round(day_work_hours($clockIn, $clockOut, $sched), 2);
    }

    // OT per rate
    $otByRate = ['1.0' => 0, '1.5' => 0, '2.0' => 0, '3.0' => 0];
    $otNotes = [];
    foreach ($otByDate[$dateStr] ?? [] as $o) {
        $key = number_format($o['ot_rate'], 1);
        if (isset($otByRate[$key])) $otByRate[$key] += $o['hours'];
        if (isset($otTotal[$key])) $otTotal[$key] += $o['hours'];
        $otRawHours += $o['hours'];
        if (!empty($o['reason'])) $otNotes[] = $o['reason'];
    }

    // Stats
    if ($status === 'present') $cntPresent++;
    elseif ($status === 'late') { $cntLate++; $totalLateMin += $lateMin; }
    elseif ($status === 'absent') $cntAbsent++;
    elseif ($status === 'leave') $cntLeave++;

    $days[] = [
        'date' => $dateStr,
        'dow' => $dow,
        'status' => $status,
        'clock_in' => $clockIn,
        'clock_out' => $clockOut,
        'late_min' => $lateMin,
        'work_hours' => $workHours,
        'leave_type' => $leaveType,
        'holiday_name' => $holidayName,
        'admin_note' => $adminNote,
        'ot_by_rate' => $otByRate,
        'ot_notes' => $otNotes,
    ];

    $current->modify('+1 day');
}

// ─── Build HTML ───
$statusLabel = function ($r) {
    if ($r['status'] === 'leave' && $r['leave_type']) return 'ลา (' . $r['leave_type'] . ')';
    if ($r['status'] === 'holiday') return 'หยุดนักขัตฤกษ์';
    $m = ['present' => 'มาทำงาน', 'late' => 'สาย', 'absent' => 'ขาดงาน', 'leave' => 'ลา', 'weekend' => 'วันหยุด', 'offday_work' => 'ทำงานวันหยุด (OT?)', 'future' => '-', 'pre_hire' => 'ยังไม่เข้างาน'];
    return $m[$r['status']] ?? $r['status'];
};
$rowBg = function ($r) {
    if ($r['status'] === 'absent') return '#d1d5db';
    if ($r['status'] === 'late')   return '#e5e7eb';
    if ($r['status'] === 'leave')  return '#ededed';
    if ($r['status'] === 'holiday') return '#f3f4f6';
    if ($r['status'] === 'weekend') return '#f9fafb';
    if ($r['status'] === 'offday_work') return '#fef3c7'; // amber — OT candidate, draws HR's eye
    if ($r['status'] === 'pre_hire') return '#fafafa';
    return '#ffffff';
};
$esc = function ($v) { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8'); };
$fmtOt = function ($v) { return $v > 0 ? rtrim(rtrim(number_format($v, 1, '.', ''), '0'), '.') : ''; };
$fmtT  = function ($v) { return $v > 0 ? rtrim(rtrim(number_format($v, 1, '.', ''), '0'), '.') : '–'; };

// Period label
if ($date_from && $date_to) {
    $periodLabel = $date_from . ' — ' . $date_to;
} elseif ($cutoff_month) {
    $periodLabel = $startDate . ' — ' . $endDate;
} else {
    $thMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    [$y, $m] = explode('-', $month);
    $periodLabel = $thMonths[(int)$m] . ' ' . ((int)$y + 543);
}

ob_start();
?>
<style>
    /* Tuned to fit 31 days + header + summary on a single A4 landscape page. */
    * { box-sizing: border-box; font-family: thsarabun, sans-serif; }
    body { margin: 0; padding: 0; color: #000; }
    h1 { font-size: 14pt; font-weight: bold; margin: 0 0 1px 0; }
    .meta { font-size: 11pt; margin: 0; line-height: 1.2; }
    table { width: 100%; border-collapse: collapse; margin-top: 3px; font-size: 11pt; }
    th, td { border: 1px solid #000; padding: 0 4px; vertical-align: middle; line-height: 1.15; }
    th { background: #d1d5db; font-weight: bold; text-align: center; font-size: 11pt; }
    td.c { text-align: center; }
    td.b { font-weight: bold; }
    td.ot { font-weight: bold; text-align: center; }
    td.n { font-size: 10pt; white-space: nowrap; overflow: hidden; }
    .foot { font-size: 9pt; color: #374151; margin-top: 2px; }
</style>

<h1>รายงานเข้างานรายวัน — <?= $esc($periodLabel) ?></h1>
<div class="meta">พนักงาน: <b><?= $esc($emp['name']) ?></b> (<?= $esc($emp['id']) ?>)</div>
<div class="meta">
    แผนก: <b><?= $esc($emp['department'] ?? '-') ?></b>
    &nbsp;&nbsp;&nbsp;เวลาเข้างาน: <b><?= $esc(substr($workStart, 0, 5)) ?> น.</b>
    &nbsp;&nbsp;&nbsp;เวลาออกงาน: <b><?= $esc(substr($workEnd, 0, 5)) ?> น.</b>
</div>

<table>
    <thead>
        <tr>
            <th rowspan="2" width="7%">วันที่</th>
            <th rowspan="2" width="5%">วัน</th>
            <th rowspan="2" width="6%">เข้างาน</th>
            <th rowspan="2" width="6%">ออกงาน</th>
            <th rowspan="2" width="14%">สถานะ</th>
            <th rowspan="2" width="6%">สาย (นาที)</th>
            <th rowspan="2" width="8%">ชม.ทำงาน</th>
            <th colspan="4" width="20%">OT (เวลา / อัตรา / ชม.)</th>
            <th rowspan="2" width="11%">หมายเหตุ OT</th>
            <th rowspan="2" width="17%">หมายเหตุ</th>
        </tr>
        <tr>
            <th width="5%">1</th>
            <th width="5%">1.5</th>
            <th width="5%">2</th>
            <th width="5%">3</th>
        </tr>
    </thead>
    <tbody>
    <?php foreach ($days as $r):
        $d = new DateTime($r['date']);
        $dateStr = $d->format('d/m/') . ((int)$d->format('Y') + 543);
        $noteParts = [];
        if ($r['holiday_name']) $noteParts[] = $r['holiday_name'];
        if ($r['status'] === 'leave' && $r['leave_type']) $noteParts[] = $r['leave_type'];
        if ($r['status'] === 'absent') $noteParts[] = 'ไม่มาทำงาน';
        if ($r['admin_note']) $noteParts[] = '✎ ' . $r['admin_note'];
        $bg = $rowBg($r);
        $flagged = $r['status'] === 'late' || $r['status'] === 'absent';
    ?>
        <tr style="background: <?= $bg ?>">
            <td class="c"><?= $esc($dateStr) ?></td>
            <td class="c"><?= $esc($dowNames[$r['dow']] ?? '') ?></td>
            <td class="c<?= $r['status'] === 'late' ? ' b' : '' ?>"><?= $r['clock_in'] ? $esc(substr($r['clock_in'], 0, 5)) : '-' ?></td>
            <td class="c"><?= $r['clock_out'] ? $esc(substr($r['clock_out'], 0, 5)) : '-' ?></td>
            <td<?= $flagged ? ' class="b"' : '' ?>><?= $esc($statusLabel($r)) ?></td>
            <td class="c"><?= $r['late_min'] > 0 ? $r['late_min'] : '' ?></td>
            <td class="c"><?= $r['work_hours'] > 0 ? rtrim(rtrim(number_format($r['work_hours'], 1, '.', ''), '0'), '.') : '' ?></td>
            <td class="ot"><?= $fmtOt($r['ot_by_rate']['1.0']) ?></td>
            <td class="ot"><?= $fmtOt($r['ot_by_rate']['1.5']) ?></td>
            <td class="ot"><?= $fmtOt($r['ot_by_rate']['2.0']) ?></td>
            <td class="ot"><?= $fmtOt($r['ot_by_rate']['3.0']) ?></td>
            <td class="n"><?= $esc(implode(' • ', $r['ot_notes'])) ?></td>
            <td class="n"><?= $esc(implode(' • ', $noteParts)) ?></td>
        </tr>
    <?php endforeach; ?>
        <tr style="background: #9ca3af; font-weight: bold;">
            <td class="c"><b>สรุป</b></td>
            <td colspan="4"><b>มา:<?= $cntPresent ?>&nbsp;&nbsp;สาย:<?= $cntLate ?>&nbsp;&nbsp;ขาด:<?= $cntAbsent ?>&nbsp;&nbsp;ลา:<?= $cntLeave ?></b></td>
            <td colspan="2" align="right"><b>สายรวม <?= $totalLateMin ?> นาที</b></td>
            <td class="c"><b><?= $fmtT($otTotal['1.0']) ?></b></td>
            <td class="c"><b><?= $fmtT($otTotal['1.5']) ?></b></td>
            <td class="c"><b><?= $fmtT($otTotal['2.0']) ?></b></td>
            <td class="c"><b><?= $fmtT($otTotal['3.0']) ?></b></td>
            <td colspan="2" class="c"><b>OT รวม <?= rtrim(rtrim(number_format($otRawHours, 1, '.', ''), '0'), '.') ?> ชม.</b></td>
        </tr>
    </tbody>
</table>

<p class="foot">หมายเหตุ: ชั่วโมง OT แสดงในช่องอัตราที่ตรง (×1 / ×1.5 / ×2 / ×3) — ฝ่ายบัญชีนำไปคำนวณเงินเองตามอัตรา</p>
<?php
$html = ob_get_clean();

// ─── Render PDF via mPDF ───
$defaultConfig = (new \Mpdf\Config\ConfigVariables())->getDefaults();
$fontDirs = $defaultConfig['fontDir'];
$defaultFontConfig = (new \Mpdf\Config\FontVariables())->getDefaults();
$fontData = $defaultFontConfig['fontdata'];

$mpdf = new \Mpdf\Mpdf([
    'mode' => 'utf-8',
    'format' => 'A4-L', // A4 Landscape
    'margin_top' => 4,
    'margin_bottom' => 4,
    'margin_left' => 4,
    'margin_right' => 4,
    'tempDir' => sys_get_temp_dir(),
    'fontDir' => array_merge($fontDirs, [
        __DIR__ . '/lib/vendor/mpdf/mpdf/ttfonts',
    ]),
    'fontdata' => $fontData + [
        'thsarabun' => [
            'R' => 'THSarabunNew.ttf',
            'B' => 'THSarabunNew-Bold.ttf',
            // useOTL disabled — when on, mPDF inserts ZWSP-like markers for Thai
            // dictionary line-breaks. Font lacks glyphs for those → tofu boxes.
            'useOTL' => 0,
            'useKashida' => 0,
        ],
    ],
    'default_font' => 'thsarabun',
    'default_font_size' => 11,
]);
// Disable dictionary-based line breaking for Asian languages
// (Thai, Chinese, Japanese) — prevents zero-width markers becoming tofu glyphs.
$mpdf->useDictionaryLBR = false;
$mpdf->useTibetanLBR = false;
$mpdf->WriteHTML($html);

// Build filename
$safeName = preg_replace('/[^\w\s.-]/u', '', $emp['name'] ?? $employee_id);
$periodSlug = $date_from && $date_to ? "{$date_from}_{$date_to}" : ($cutoff_month ? "cutoff-{$cutoff_month}" : $month);
$filename = "attendance_{$employee_id}_{$safeName}_{$periodSlug}.pdf";

// Output: Inline (I) lets browser preview; D forces download. Use I so frontend
// can fetch the blob and bundle into ZIP without triggering individual downloads.
$mpdf->Output($filename, \Mpdf\Output\Destination::INLINE);
