-- =====================================================
-- Migration: Add GPS support to attendance system
-- Date: 2026-02-14
-- =====================================================

USE `hr_mobile_connect`;

-- 1. Create work_locations table (allowed check-in zones)
CREATE TABLE IF NOT EXISTS `work_locations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `latitude` DECIMAL(10,7) NOT NULL,
  `longitude` DECIMAL(10,7) NOT NULL,
  `radius_meters` INT DEFAULT 200,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed: example office location (Bangkok CBD)
INSERT INTO `work_locations` (`name`, `latitude`, `longitude`, `radius_meters`) VALUES
('สำนักงานใหญ่ กรุงเทพฯ', 13.7563309, 100.5017651, 200),
('สาขาเชียงใหม่', 18.7883439, 98.9853008, 200);

-- 2. Add GPS columns to attendance table
ALTER TABLE `attendance`
  ADD COLUMN `latitude` DECIMAL(10,7) DEFAULT NULL AFTER `location`,
  ADD COLUMN `longitude` DECIMAL(10,7) DEFAULT NULL AFTER `latitude`,
  ADD COLUMN `is_offsite` TINYINT(1) DEFAULT 0 AFTER `longitude`,
  ADD COLUMN `location_name` VARCHAR(200) DEFAULT NULL AFTER `is_offsite`,
  ADD COLUMN `clock_out_latitude` DECIMAL(10,7) DEFAULT NULL AFTER `location_name`,
  ADD COLUMN `clock_out_longitude` DECIMAL(10,7) DEFAULT NULL AFTER `clock_out_latitude`;
