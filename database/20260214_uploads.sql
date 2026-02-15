-- Migration: Centralized uploads table + icon_url for leave_types
-- Date: 2026-02-14

-- 1. Create uploads table
CREATE TABLE IF NOT EXISTS `uploads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `filename` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) DEFAULT NULL,
  `file_size` INT DEFAULT 0,
  `category` VARCHAR(50) DEFAULT 'general',
  `related_id` VARCHAR(50) DEFAULT NULL,
  `uploaded_by` VARCHAR(20) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_related` (`category`, `related_id`)
) ENGINE=InnoDB;

-- 2. Add icon_url to leave_types
ALTER TABLE `leave_types` ADD COLUMN `icon_url` VARCHAR(500) DEFAULT NULL AFTER `icon`;
