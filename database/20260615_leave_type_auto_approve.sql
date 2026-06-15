-- 2026-06-15: Auto-approve flag for leave types
-- When set, an employee's own submission of this leave type is recorded as
-- already-approved (is_bypass=1) instead of entering the tier-1/tier-2 approval
-- flow. Use case: self-service Work-from-Home, where staff cannot clock in via
-- the geofence and a per-request manager approval is unnecessary overhead.
-- Quota is still enforced (approved requests burn quota as usual).

ALTER TABLE leave_types
  ADD COLUMN IF NOT EXISTS auto_approve TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Employee submissions of this type are auto-approved (bypass approval flow)';
