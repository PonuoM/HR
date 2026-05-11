-- =====================================================
-- Migration: Allow NULL leave_type_id for OT requests
-- Date: 2026-03-04
-- Issue: OT requests sent leave_type_id = 0 which violates
--        the FK constraint to leave_types. Fix: allow NULL.
-- =====================================================

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE `leave_requests` DROP FOREIGN KEY `leave_requests_ibfk_2`;

-- Step 2: Make leave_type_id nullable
ALTER TABLE `leave_requests` MODIFY COLUMN `leave_type_id` INT DEFAULT NULL;

-- Step 3: Re-add the FK constraint with NULL support
ALTER TABLE `leave_requests` 
  ADD CONSTRAINT `fk_leave_requests_leave_type` 
  FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE SET NULL;
