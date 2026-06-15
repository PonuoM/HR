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

if (!function_exists('build_workday_index')) {
    /**
     * Build a fast lookup index from work_day_overrides rows.
     * Returns ['company'=>[date=>true], 'dept'=>[deptId=>[date=>true]], 'emp'=>[empId=>[date=>true]]].
     */
    function build_workday_index($rows) {
        $idx = ['company' => [], 'dept' => [], 'emp' => []];
        foreach ($rows as $r) {
            $d = $r['date'];
            $scope = $r['scope'] ?? 'company';
            if ($scope === 'company') {
                $idx['company'][$d] = true;
            } elseif ($scope === 'department' && $r['department_id'] !== null) {
                $idx['dept'][(int)$r['department_id']][$d] = true;
            } elseif ($scope === 'employee' && $r['employee_id'] !== null) {
                $idx['emp'][$r['employee_id']][$d] = true;
            }
        }
        return $idx;
    }
}

if (!function_exists('is_extra_workday')) {
    /**
     * Does an "extra working day" override apply to THIS employee on $date?
     * Matches a company-wide, this-employee's-department, or this-employee row.
     * Requires $emp to carry 'department_id' and 'id' for dept/employee scopes.
     */
    function is_extra_workday($emp, $date, $idx) {
        if (!$idx) return false;
        if (!empty($idx['company'][$date])) return true;
        $deptId = $emp['department_id'] ?? null;
        if ($deptId !== null && !empty($idx['dept'][(int)$deptId][$date])) return true;
        $empId = $emp['id'] ?? null;
        if ($empId !== null && !empty($idx['emp'][$empId][$date])) return true;
        return false;
    }
}

if (!function_exists('fetch_workday_index')) {
    /**
     * Load work_day_overrides for a company within [$start,$end] and return the
     * lookup index. Safe if the table is missing (returns an empty index) so the
     * app keeps working before/without the migration.
     */
    function fetch_workday_index($conn, $company_id, $start, $end) {
        $empty = ['company' => [], 'dept' => [], 'emp' => []];
        $stmt = @$conn->prepare("SELECT date, scope, department_id, employee_id FROM work_day_overrides WHERE company_id = ? AND date BETWEEN ? AND ?");
        if (!$stmt) return $empty;
        $stmt->bind_param('iss', $company_id, $start, $end);
        if (!$stmt->execute()) return $empty;
        $res = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        return build_workday_index($rows);
    }
}

if (!function_exists('merge_workday_index')) {
    /** Union two work-day override indexes (manual ∪ inferred). */
    function merge_workday_index($a, $b) {
        $out = $a;
        foreach (($b['company'] ?? []) as $d => $v) $out['company'][$d] = true;
        foreach (($b['dept'] ?? []) as $dept => $dates) {
            foreach ($dates as $d => $v) $out['dept'][$dept][$d] = true;
        }
        foreach (($b['emp'] ?? []) as $emp => $dates) {
            foreach ($dates as $d => $v) $out['emp'][$emp][$d] = true;
        }
        return $out;
    }
}

if (!function_exists('fetch_inferred_workday_index')) {
    /**
     * Infer department working-days from turnout: for each (department, date),
     * if MORE THAN $threshold of the department's active staff clocked in, treat
     * that date as a department working day. Lets the system tell a real dept
     * working-Saturday (most of the team came → no-shows = absent) from individual
     * OT (only a few came → those people = OT candidates) without HR pre-marking.
     *
     * Returned as a dept-scoped override index, ready to merge into the manual one.
     * HR-facing surfaces only (reports/CSV/PDF) — deliberately NOT used for
     * employee alerts/calendar so nobody gets a false "missing clock-in" alert.
     */
    function fetch_inferred_workday_index($conn, $company_id, $start, $end, $threshold = 0.5) {
        $idx = ['company' => [], 'dept' => [], 'emp' => []];

        // Active headcount per department
        $head = [];
        $hStmt = @$conn->prepare("SELECT department_id, COUNT(*) AS n FROM employees
                                  WHERE company_id = ? AND is_active = 1 AND department_id IS NOT NULL
                                  GROUP BY department_id");
        if (!$hStmt) return $idx;
        $hStmt->bind_param('i', $company_id);
        if (!$hStmt->execute()) return $idx;
        $hRes = $hStmt->get_result();
        while ($r = $hRes->fetch_assoc()) $head[(int)$r['department_id']] = (int)$r['n'];

        // Distinct clock-ins per (department, date)
        $cStmt = @$conn->prepare("SELECT e.department_id, a.date, COUNT(DISTINCT a.employee_id) AS c
                                  FROM attendance a JOIN employees e ON a.employee_id = e.id
                                  WHERE e.company_id = ? AND e.is_active = 1 AND a.clock_in IS NOT NULL
                                    AND a.date BETWEEN ? AND ? AND e.department_id IS NOT NULL
                                  GROUP BY e.department_id, a.date");
        if (!$cStmt) return $idx;
        $cStmt->bind_param('iss', $company_id, $start, $end);
        if (!$cStmt->execute()) return $idx;
        $cRes = $cStmt->get_result();
        while ($r = $cRes->fetch_assoc()) {
            $dept = (int)$r['department_id'];
            $n = $head[$dept] ?? 0;
            // Strictly MORE than half the department (เกินครึ่ง) = department working day
            if ($n > 0 && (int)$r['c'] > $n * $threshold) {
                $idx['dept'][$dept][$r['date']] = true;
            }
        }
        return $idx;
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
    function resolve_schedule_for_date($emp, $date, $extraIdx = null) {
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

        // Active by schedule, honouring the alternating-week (เสาร์เว้นเสาร์) filter
        $weeksMode = $entry['weeks'] ?? 'all';
        $active = !empty($entry['active']);
        if ($weeksMode === 'odd' && $weekParity !== 'odd') $active = false;
        if ($weeksMode === 'even' && $weekParity !== 'even') $active = false;

        // Grace period: emp override > dept default > 0
        $grace = $emp['late_grace_minutes'] ?? null;
        if ($grace === null || $grace === '') {
            $grace = $emp['dept_late_grace_minutes'] ?? 0;
        }

        if ($active) {
            return [
                'active'     => true,
                'in'         => $entry['in']  ?? '09:00',
                'out'        => $entry['out'] ?? '17:00',
                'lunch_min'  => isset($entry['lunch_min']) ? (int)$entry['lunch_min'] : 60,
                'late_grace' => (int) $grace,
                'source'     => $source,
            ];
        }

        // Not active by schedule — but a manager-assigned "extra working day"
        // (วันทำงานพิเศษ, e.g. a worked Saturday) forces it active using dept hours.
        if ($extraIdx && is_extra_workday($emp, $date, $extraIdx)) {
            $in  = substr($emp['dept_work_start_time'] ?? $emp['work_start_time'] ?? '09:00:00', 0, 5);
            $out = substr($emp['dept_work_end_time'] ?? $emp['work_end_time'] ?? '17:00:00', 0, 5);
            return [
                'active'     => true,
                'in'         => $in ?: '09:00',
                'out'        => $out ?: '17:00',
                'lunch_min'  => 60,
                'late_grace' => (int) $grace,
                'source'     => 'override',
            ];
        }

        return [
            'active' => false, 'in' => null, 'out' => null,
            'lunch_min' => 0, 'late_grace' => 0, 'source' => $source,
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

if (!function_exists('is_active_workday')) {
    /**
     * Is $date an actual working day for THIS employee?
     * True only when the resolved schedule is active AND the date is not a holiday.
     * Replaces all hardcoded "$dow <= 5" / "$dow > 5" weekend checks so that
     * 6-day (เสาร์), alternating-week (เสาร์เว้นเสาร์) and per-employee overrides
     * are all honoured consistently.
     *
     * @param array  $emp          employee record (with schedule_json + dept_ fallback fields)
     * @param string $date         YYYY-MM-DD
     * @param array  $holidayDates flat list of 'YYYY-MM-DD' strings (company holidays)
     */
    function is_active_workday($emp, $date, $holidayDates = [], $extraIdx = null) {
        if (!empty($holidayDates) && in_array($date, $holidayDates, true)) return false;
        $sched = resolve_schedule_for_date($emp, $date, $extraIdx);
        return !empty($sched['active']);
    }
}

if (!function_exists('count_active_workdays')) {
    /**
     * Count this employee's actual working days in [$start, $end] inclusive,
     * excluding holidays and schedule-inactive days. Schedule-aware replacement
     * for the old Mon–Fri getWorkingDays()/countLeaveDaysInPeriod() helpers.
     *
     * @param array  $holidayDates flat list of 'YYYY-MM-DD' strings
     */
    function count_active_workdays($emp, $start, $end, $holidayDates = [], $extraIdx = null) {
        if ($start > $end) return 0;
        $hset = array_flip($holidayDates);
        $count = 0;
        $cur = new DateTime($start);
        $endDt = new DateTime($end);
        while ($cur <= $endDt) {
            $d = $cur->format('Y-m-d');
            if (!isset($hset[$d])) {
                $sched = resolve_schedule_for_date($emp, $d, $extraIdx);
                if (!empty($sched['active'])) $count++;
            }
            $cur->modify('+1 day');
        }
        return $count;
    }
}

if (!function_exists('day_work_hours')) {
    /**
     * Work hours for a single day's clock-in/out, schedule-aware.
     *  - Active scheduled day → effective hours (clamped to window − lunch).
     *  - Off-schedule day (e.g. an irregular Saturday that was actually worked,
     *    where there's no defined window to clamp to) → raw elapsed time.
     * Returns 0 if either timestamp is missing.
     */
    function day_work_hours($clockIn, $clockOut, $sched) {
        if (!$clockIn || !$clockOut) return 0.0;
        if (!empty($sched['active'])) {
            return calc_effective_work_hours_v2($clockIn, $clockOut, $sched);
        }
        $raw = (strtotime($clockOut) - strtotime($clockIn)) / 3600;
        return max(0.0, $raw);
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
