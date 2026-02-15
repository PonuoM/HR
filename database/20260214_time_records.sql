-- =====================================================
-- Migration: Time Records table for retroactive/off-site clock entries
-- Date: 2026-02-14
-- =====================================================

USE `hr_mobile_connect`;

CREATE TABLE IF NOT EXISTS `time_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(20) NOT NULL,
  `record_date` DATE NOT NULL,
  `clock_in_time` TIME NOT NULL,
  `clock_out_time` TIME DEFAULT NULL,
  `location_id` INT DEFAULT NULL,
  `location_name` VARCHAR(200) DEFAULT NULL,
  `reason` TEXT DEFAULT NULL,
  `status` ENUM('pending','approved','rejected') DEFAULT 'pending',
  `approved_by` VARCHAR(20) DEFAULT NULL,
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`location_id`) REFERENCES `work_locations`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;
