-- =====================================================
-- Migration: 20260215 - Multi-tier approval tracking
-- =====================================================

-- Add tier-1 approval tracking
ALTER TABLE `leave_requests`
  ADD COLUMN `tier1_status` ENUM('pending','approved','rejected','skipped') DEFAULT 'pending' AFTER `approved_at`,
  ADD COLUMN `tier1_by` VARCHAR(20) DEFAULT NULL AFTER `tier1_status`,
  ADD COLUMN `tier1_at` TIMESTAMP NULL AFTER `tier1_by`;

-- Add tier-2 approval tracking
ALTER TABLE `leave_requests`
  ADD COLUMN `tier2_status` ENUM('pending','approved','rejected','skipped') DEFAULT 'pending' AFTER `tier1_at`,
  ADD COLUMN `tier2_by` VARCHAR(20) DEFAULT NULL AFTER `tier2_status`,
  ADD COLUMN `tier2_at` TIMESTAMP NULL AFTER `tier2_by`;

-- HR bypass flag
ALTER TABLE `leave_requests`
  ADD COLUMN `is_bypass` TINYINT(1) DEFAULT 0 AFTER `tier2_at`;

-- Store the expected approvers at request creation time
ALTER TABLE `leave_requests`
  ADD COLUMN `expected_approver1_id` VARCHAR(20) DEFAULT NULL AFTER `is_bypass`,
  ADD COLUMN `expected_approver2_id` VARCHAR(20) DEFAULT NULL AFTER `expected_approver1_id`;

-- Backfill existing approved records: mark as tier1 approved
UPDATE `leave_requests`
  SET `tier1_status` = 'approved', `tier1_by` = `approved_by`, `tier1_at` = `approved_at`,
      `tier2_status` = 'approved', `tier2_by` = `approved_by`, `tier2_at` = `approved_at`
  WHERE `status` = 'approved';

-- Backfill existing rejected records
UPDATE `leave_requests`
  SET `tier1_status` = 'rejected', `tier1_by` = `approved_by`, `tier1_at` = `approved_at`
  WHERE `status` = 'rejected';
