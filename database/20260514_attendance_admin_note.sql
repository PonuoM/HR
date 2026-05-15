-- =====================================================
-- Migration: HR note + audit fields on attendance
-- Date: 2026-05-14
-- Notes:
--   - admin_note: single-line note HR writes when manually
--     correcting / annotating an attendance row.
--   - edited_by/edited_at: audit trail for admin_edit.
-- =====================================================

ALTER TABLE `attendance`
  ADD COLUMN `admin_note` VARCHAR(500) DEFAULT NULL AFTER `clock_out`,
  ADD COLUMN `edited_by` VARCHAR(20) DEFAULT NULL AFTER `admin_note`,
  ADD COLUMN `edited_at` TIMESTAMP NULL DEFAULT NULL AFTER `edited_by`;
