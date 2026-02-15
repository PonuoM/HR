-- =====================================================
-- Approval Hierarchy Migration
-- 2026-02-14: Add approval hierarchy fields
-- =====================================================

-- 1. departments: identify HR/admin system departments
ALTER TABLE `departments` ADD COLUMN `is_admin_system` TINYINT(1) DEFAULT 0;

-- Set default HR departments
UPDATE `departments` SET `is_admin_system` = 1 WHERE `name` LIKE '%บุคค%' OR `name` LIKE '%HR%';

-- 2. positions: identify positions that can have subordinates
ALTER TABLE `positions` ADD COLUMN `can_have_subordinates` TINYINT(1) DEFAULT 0;

-- Set default manager/lead positions
UPDATE `positions` SET `can_have_subordinates` = 1 WHERE `name` LIKE '%Manager%' OR `name` LIKE '%Lead%' OR `name` LIKE '%ผู้จัดการ%' OR `name` LIKE '%หัวหน้า%';

-- 3. employees: add approver_id for step-1 approver
ALTER TABLE `employees` ADD COLUMN `approver_id` VARCHAR(20) DEFAULT NULL;
ALTER TABLE `employees` ADD CONSTRAINT `fk_approver` FOREIGN KEY (`approver_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL;
