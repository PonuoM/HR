-- =====================================================
-- Migration: Allowance (Per Diem) Request System
-- Date: 2026-02-18
-- =====================================================

USE `primacom_hr_mobile_connect`;

-- 1. Allowance types — preset + user-created
CREATE TABLE IF NOT EXISTS `allowance_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `company_id` INT DEFAULT 1,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_name_company` (`name`, `company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default types
INSERT IGNORE INTO `allowance_types` (`name`, `company_id`) VALUES
('ค่าเดินทาง', 1),
('ค่าอาหาร', 1),
('ค่าที่พัก', 1);

-- 2. Allowance requests — with tier-1+2 approval
CREATE TABLE IF NOT EXISTS `allowance_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(20) NOT NULL,
  `allowance_type` VARCHAR(200) NOT NULL,
  `location_name` VARCHAR(300) DEFAULT NULL,
  `location_address` TEXT DEFAULT NULL,
  `location_detail` TEXT DEFAULT NULL,
  `location_link` VARCHAR(500) DEFAULT NULL,
  `location_lat` DECIMAL(10,7) DEFAULT NULL,
  `location_lng` DECIMAL(10,7) DEFAULT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE DEFAULT NULL,
  `start_time` TIME DEFAULT NULL,
  `end_time` TIME DEFAULT NULL,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `reason` TEXT DEFAULT NULL,

  -- Tier approval (same pattern as time_records)
  `expected_approver1_id` VARCHAR(20) DEFAULT NULL,
  `expected_approver2_id` VARCHAR(20) DEFAULT NULL,
  `tier1_status` ENUM('pending','approved','rejected','skipped') DEFAULT 'pending',
  `tier1_by` VARCHAR(20) DEFAULT NULL,
  `tier1_at` DATETIME DEFAULT NULL,
  `tier2_status` ENUM('pending','approved','rejected','skipped') DEFAULT 'pending',
  `tier2_by` VARCHAR(20) DEFAULT NULL,
  `tier2_at` DATETIME DEFAULT NULL,

  `status` ENUM('pending','approved','rejected') DEFAULT 'pending',
  `approved_by` VARCHAR(20) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `is_bypass` TINYINT(1) DEFAULT 0,

  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY `idx_employee` (`employee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_approver1` (`expected_approver1_id`),
  KEY `idx_approver2` (`expected_approver2_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
