-- =====================================================
-- Migration: Add tier 1+2 approval columns to time_records
-- Date: 2026-02-17
-- =====================================================

USE `hr_mobile_connect`;

-- Add tier approval columns
ALTER TABLE `time_records`
  ADD COLUMN `expected_approver1_id` VARCHAR(20) DEFAULT NULL AFTER `reason`,
  ADD COLUMN `expected_approver2_id` VARCHAR(20) DEFAULT NULL AFTER `expected_approver1_id`,
  ADD COLUMN `tier1_status` ENUM('pending','approved','rejected','skipped') DEFAULT 'pending' AFTER `expected_approver2_id`,
  ADD COLUMN `tier1_by` VARCHAR(20) DEFAULT NULL AFTER `tier1_status`,
  ADD COLUMN `tier1_at` TIMESTAMP NULL DEFAULT NULL AFTER `tier1_by`,
  ADD COLUMN `tier2_status` ENUM('pending','approved','rejected','skipped') DEFAULT 'pending' AFTER `tier1_at`,
  ADD COLUMN `tier2_by` VARCHAR(20) DEFAULT NULL AFTER `tier2_status`,
  ADD COLUMN `tier2_at` TIMESTAMP NULL DEFAULT NULL AFTER `tier2_by`,
  ADD COLUMN `is_bypass` TINYINT(1) DEFAULT 0 AFTER `tier2_at`;
