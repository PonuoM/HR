<?php
/**
 * Work Schedule Helper
 * --------------------------------------------------------------
 * Resolves the effective work schedule for an employee on a given date,
 * taking into account:
 *   1. employee.schedule_json   (per-employee override, highest priority)
 *   2. department.schedule_json (dept default)
 *   3. department.work_start_time / work_end_time (legacy fallback)
 *
 * Schedule JSON shape (keys 1..7 = ISO day-of-week, Mon=1 .. Sun=7):
 * {
 *   "1": { "active": true, "in": "09:00", "out": "18:00", "lunch_min": 60 },
 *   ...
 *   "6": { "active": true, "in": "09:00", "out": "13:00", "lunch_min": 0, "weeks": "odd" },
 *   "7": { "active": false }
 * }
 *   - "weeks": "all" (default) | "odd" | "even"  → ISO week-number parity
 */

if (!function_exists('parse_schedule_json')) {
    function parse_schedule_json($jsonStr) {
        if (!$jsonStr) return null;
        $arr = json_decode($jsonStr, true);
        if (!is_array($arr)) return null;
        return $arr;
    }
}

if (!function_exists('legacy_schedule')) {
    /**
     * Build a 5-day weekly schedule from legacy work_start_time / work_end_time.
     * Used as fallback when no schedule_json is set.
     */
    function legacy_schedule($workStart, $workEnd) {
        $workStart = $workStart ?: '09:00:00';
        $workEnd = $workEnd ?: '17:00:00';
        $in = substr($workStart, 0, 5);
        $out = substr($workEnd, 0, 5);
        $sched = [];
        for ($d = 1; $d <= 5; $d++) {
            $sched[(string)$d] = ['active' => true, 'in' => $in, 'out' => $out, 'lunch_min' => 60];
        }
        $sched['6'] = ['active' => false];
        $sched['7'] = ['active' => false];
        return $sched;
    }
}

if (!function_exists('resolve_schedule_for_date')) {
    /**
     * Resolve effective schedule entry for a specific date.
     *
     * @param array  $emp   employee record (must have keys: schedule_json, work_start_time, work_end_time, late_grace_minutes optional)
     *                      and optionally dept fields prefixed with dept_ (dept_schedule_json, dept_work_start_time, dept_work_end_time, dept_late_grace_minutes)
     * @param string $date  YYYY-MM-DD
     * @return array {
     *   active     : bool,
     *   in         : "HH:MM" or null if !active,
     *   out        : "HH:MM" or null if !active,
     *   lunch_min  : int,
     *   late_grace : int,
     *   source     : 'employee' | 'department' | 'legacy'
     * }
     */
    function resolve_schedule_for_date($emp, $date) {
        $dt = new DateTime($date);
        $dow = (int) $dt->format('N'); // 1..7
        $isoWeek = (int) $dt->format('W'); // 1..53
        $weekParity = ($isoWeek % 2 === 1) ? 'odd' : 'even';

        // Pick schedule source by priority
        $source = 'legacy';
        $schedArr = parse_schedule_json($emp['schedule_json'] ?? null);
        if ($schedArr) {
            $source = 'employee';
        } else {
            $schedArr = parse_schedule_json($emp['dept_schedule_json'] ?? null);
            if ($schedArr) $source = 'department';
        }
        if (!$schedArr) {
            // Legacy fallback — use dept's work_start_time/work_end_time
            $schedArr = legacy_schedule(
                $emp['dept_work_start_time'] ?? $emp['work_start_time'] ?? null,
                $emp['dept_work_end_time'] ?? $emp['work_end_time'] ?? null
            );
        }

        $entry = $schedArr[(string)$dow] ?? ['active' => false];

        // Apply alternating-week filter
        $weeksMode = $entry['weeks'] ?? 'all';
        if ($weeksMode === 'odd' && $weekParity !== 'odd') {
            return [
                'active' => false, 'in' => null, 'out' => null,
                'lunch_min' => 0, 'late_grace' => 0, 'source' => $source,
            ];
        }
        if ($weeksMode === 'even' && $weekParity !== 'even') {
            return [
                'active' => false, 'in' => null, 'out' => null,
                'lunch_min' => 0, 'late_grace' => 0, 'source' => $source,
            ];
        }

        $active = !empty($entry['active']);
        if (!$active) {
            return [
                'active' => false, 'in' => null, 'out' => null,
                'lunch_min' => 0, 'late_grace' => 0, 'source' => $source,
            ];
        }

        // Grace period: emp override > dept default > 0
        $grace = $emp['late_grace_minutes'];
        if ($grace === null || $grace === '') {
            $grace = $emp['dept_late_grace_minutes'] ?? 0;
        }

        return [
            'active'     => true,
            'in'         => $entry['in']  ?? '09:00',
            'out'        => $entry['out'] ?? '17:00',
            'lunch_min'  => isset($entry['lunch_min']) ? (int)$entry['lunch_min'] : 60,
            'late_grace' => (int) $grace,
            'source'     => $source,
        ];
    }
}

if (!function_exists('calc_effective_work_hours_v2')) {
    /**
     * Effective work hours from a clock-in/out, given a resolved schedule entry.
     * Clamps to scheduled window + subtracts lunch (centered around 12:30 by default).
     *
     * @param string $clockIn   "HH:MM:SS"
     * @param string $clockOut  "HH:MM:SS"
     * @param array  $sched     resolve_schedule_for_date() result (must be active)
     * @return float            hours (0 if invalid or schedule inactive)
     */
    function calc_effective_work_hours_v2($clockIn, $clockOut, $sched) {
        if (!$sched['active']) return 0.0;
        $toSec = static function ($t) {
            $parts = array_pad(explode(':', $t), 3, 0);
            return ((int) $parts[0]) * 3600 + ((int) $parts[1]) * 60 + ((int) $parts[2]);
        };
        $cin  = $toSec($clockIn);
        $cout = $toSec($clockOut);
        $sin  = $toSec($sched['in']);
        $sout = $toSec($sched['out']);
        $effIn  = max($cin, $sin);
        $effOut = min($cout, $sout);
        if ($effOut <= $effIn) return 0.0;
        $worked = $effOut - $effIn;

        // Lunch: centered roughly at 12:30 by default, with $lunch_min duration.
        $lunchMin = (int) ($sched['lunch_min'] ?? 60);
        if ($lunchMin > 0) {
            $lunchHalf = ($lunchMin * 60) / 2;
            $lunchCenter = 12.5 * 3600; // 12:30
            $lin  = $lunchCenter - $lunchHalf;
            $lout = $lunchCenter + $lunchHalf;
            $overlap = max(0, min($effOut, $lout) - max($effIn, $lin));
            $worked -= $overlap;
        }
        return max(0.0, $worked / 3600);
    }
}

if (!function_exists('is_late')) {
    /**
     * Decide if a clock-in is "late" given a resolved schedule (with grace period).
     * Returns [is_late_bool, late_minutes_int].
     */
    function is_late($clockIn, $sched) {
        if (!$sched['active'] || !$clockIn) return [false, 0];
        $inMin = floor(strtotime($clockIn) / 60);
        $startMin = floor(strtotime($sched['in']) / 60);
        $diff = $inMin - $startMin;
        $grace = (int) ($sched['late_grace'] ?? 0);
        if ($diff > $grace) return [true, max(0, $diff)]; // count full lateness, ignore grace only for status flag
        return [false, 0];
    }
}

if (!function_exists('is_early_leave')) {
    /**
     * Decide if a clock-out is "early leave". Returns [bool, minutes_early].
     */
    function is_early_leave($clockOut, $sched) {
        if (!$sched['active'] || !$clockOut) return [false, 0];
        $outMin = floor(strtotime($clockOut) / 60);
        $endMin = floor(strtotime($sched['out']) / 60);
        $diff = $endMin - $outMin;
        if ($diff > 0) return [true, $diff];
        return [false, 0];
    }
}
