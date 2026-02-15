-- Migration: Add base_salary column to employees table
-- Used for OT calculation
-- Date: 2026-02-14

ALTER TABLE `employees`
ADD COLUMN `base_salary` DECIMAL(10,2) DEFAULT NULL
AFTER `employment_type`;

-- Set sample salaries for existing employees
UPDATE `employees` SET `base_salary` = 35000.00 WHERE `id` = 'EMP001';
UPDATE `employees` SET `base_salary` = 45000.00 WHERE `id` = 'EMP002';
UPDATE `employees` SET `base_salary` = 28000.00 WHERE `id` = 'EMP003';
UPDATE `employees` SET `base_salary` = 32000.00 WHERE `id` = 'EMP004';
UPDATE `employees` SET `base_salary` = 50000.00 WHERE `id` = 'EMP005';
