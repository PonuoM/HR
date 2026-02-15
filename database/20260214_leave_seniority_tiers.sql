-- Migration: Add seniority tiers, probation, prorate, advance notice to leave system
-- Date: 2026-02-14

-- 1. Add new columns to leave_types
ALTER TABLE `leave_types`
  ADD COLUMN `probation_months` INT DEFAULT 0 AFTER `requires_doc`,
  ADD COLUMN `grant_timing` VARCHAR(20) DEFAULT 'next_year' AFTER `probation_months`,
  ADD COLUMN `prorate_first_year` TINYINT(1) DEFAULT 1 AFTER `grant_timing`,
  ADD COLUMN `advance_notice_days` INT DEFAULT 0 AFTER `prorate_first_year`;

-- 2. Create seniority tiers table
CREATE TABLE IF NOT EXISTS `leave_seniority_tiers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `leave_type_id` INT NOT NULL,
  `min_years` INT NOT NULL,
  `days` INT NOT NULL,
  UNIQUE KEY `uq_type_years` (`leave_type_id`, `min_years`),
  FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Configure พักร้อน (id=1): probation 6 months, immediate prorate, advance 3 days
UPDATE `leave_types` SET
  `probation_months` = 6,
  `grant_timing` = 'immediate',
  `prorate_first_year` = 1,
  `advance_notice_days` = 3
WHERE `id` = 1;

-- 4. Seniority tiers for พักร้อน
INSERT INTO `leave_seniority_tiers` (`leave_type_id`, `min_years`, `days`) VALUES
(1, 1, 6),
(1, 3, 8),
(1, 5, 10),
(1, 10, 15);
