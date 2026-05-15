-- =====================================================
-- Migration: Add ot_rate (OT multiplier) to leave_requests
-- Date: 2026-05-14
-- Notes:
--   - ot_rate is the OT multiplier (1.0, 1.5, 2.0, 3.0)
--   - NULL = not an OT entry (leave entries)
--   - Legacy approved OT entries default to 1.0
--   - HR can edit later from Attendance Report modal
-- =====================================================

ALTER TABLE `leave_requests`
  ADD COLUMN `ot_rate` DECIMAL(3,1) DEFAULT NULL AFTER `total_days`;

-- Backfill: existing approved OT entries -> rate = 1.0
UPDATE `leave_requests`
   SET `ot_rate` = 1.0
 WHERE `reason` LIKE '[OT]%'
   AND `ot_rate` IS NULL;
