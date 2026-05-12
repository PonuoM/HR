-- 2026-05-12: Flexible work-schedule support
-- Adds:
--   * schedule_json — weekly pattern (per-day in/out, lunch_min, alternating-week)
--   * late_grace_minutes — grace period before "late" status applies
--
-- Both fields exist on departments AND employees:
--   * Department-level = company default for the dept
--   * Employee-level   = override (NULL = use dept's)
--
-- schedule_json shape:
-- {
--   "1": { "active": true,  "in": "09:00", "out": "18:00", "lunch_min": 60 },
--   "2": { ... },
--   ...
--   "6": { "active": true,  "in": "09:00", "out": "13:00", "lunch_min": 0, "weeks": "odd" },
--   "7": { "active": false }
-- }
-- Keys 1..7 = day_of_week (Mon..Sun, ISO).
-- "weeks": "all" (default) | "odd" | "even"  (ISO week parity for เสาร์เว้นเสาร์)

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS schedule_json TEXT NULL COMMENT 'Weekly schedule JSON (overrides work_start/end if set)',
  ADD COLUMN IF NOT EXISTS late_grace_minutes INT NULL COMMENT 'Grace period in minutes before late counts';

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS schedule_json TEXT NULL COMMENT 'Weekly schedule JSON (overrides department schedule if set)',
  ADD COLUMN IF NOT EXISTS late_grace_minutes INT NULL COMMENT 'Grace period in minutes (overrides department setting if set)';
