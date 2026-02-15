-- Migration: Add hire_date column to employees table
-- Date: 2026-02-14

ALTER TABLE `employees`
ADD COLUMN `hire_date` DATE DEFAULT NULL
AFTER `base_salary`;

-- Set sample hire dates
UPDATE `employees` SET `hire_date` = '2023-03-15' WHERE `id` = 'EMP001';
UPDATE `employees` SET `hire_date` = '2022-06-01' WHERE `id` = 'EMP002';
UPDATE `employees` SET `hire_date` = '2023-09-10' WHERE `id` = 'EMP003';
UPDATE `employees` SET `hire_date` = '2024-01-08' WHERE `id` = 'EMP004';
UPDATE `employees` SET `hire_date` = '2021-11-20' WHERE `id` = 'EMP005';
