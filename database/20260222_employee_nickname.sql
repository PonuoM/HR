-- Add nickname column to employees table
ALTER TABLE `employees` ADD COLUMN `nickname` VARCHAR(50) DEFAULT NULL AFTER `name`;
