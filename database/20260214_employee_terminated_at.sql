-- Migration: Add terminated_at to employees for suspend/termination date tracking
-- Date: 2026-02-14

ALTER TABLE `employees` ADD COLUMN `terminated_at` DATE DEFAULT NULL AFTER `is_active`;
