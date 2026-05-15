-- =====================================================
-- Migration: Face descriptor v2 (Human / MobileFaceNet)
-- Date: 2026-05-15
-- Notes:
--   - face_descriptor_v2 stores the Human library's MobileFaceNet embedding
--     (typically 1024-dim float array, JSON-encoded).
--   - face_descriptor (legacy) stays in place during the soft-migration
--     window so users aren't blocked at clock-in.
--   - face_descriptor_migrated_at lets us report % of staff migrated and
--     decide when it's safe to drop the legacy column.
--   - Both columns are nullable; verify endpoint reads v2 first, falls
--     back to legacy, and prompts re-registration when only legacy exists.
-- =====================================================

ALTER TABLE `employees`
  ADD COLUMN `face_descriptor_v2` LONGTEXT NULL AFTER `face_descriptor`,
  ADD COLUMN `face_descriptor_migrated_at` TIMESTAMP NULL DEFAULT NULL AFTER `face_descriptor_v2`;
