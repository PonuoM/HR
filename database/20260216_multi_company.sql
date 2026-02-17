-- ============================================================
-- Multi-Company Support Migration
-- Date: 2026-02-16
-- Description: Add companies table and company_id to tenant-scoped tables
-- ============================================================

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS `companies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE COMMENT 'Short code e.g. PRM',
  `name` VARCHAR(100) NOT NULL,
  `logo_url` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed first company (existing data belongs to this company)
INSERT INTO `companies` (`id`, `code`, `name`) VALUES (1, 'PRM', 'Primapassion49')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================================
-- 3. Add company_id columns to tenant-scoped tables
-- ============================================================

-- employees
ALTER TABLE `employees` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `employees` ADD INDEX `idx_employees_company` (`company_id`);
ALTER TABLE `employees` ADD CONSTRAINT `fk_employees_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- departments
ALTER TABLE `departments` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `departments` ADD INDEX `idx_departments_company` (`company_id`);
ALTER TABLE `departments` ADD CONSTRAINT `fk_departments_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- positions
ALTER TABLE `positions` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `positions` ADD INDEX `idx_positions_company` (`company_id`);
ALTER TABLE `positions` ADD CONSTRAINT `fk_positions_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- leave_types
ALTER TABLE `leave_types` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `leave_types` ADD INDEX `idx_leave_types_company` (`company_id`);
ALTER TABLE `leave_types` ADD CONSTRAINT `fk_leave_types_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- leave_seniority_tiers
ALTER TABLE `leave_seniority_tiers` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `leave_seniority_tiers` ADD INDEX `idx_leave_seniority_tiers_company` (`company_id`);
ALTER TABLE `leave_seniority_tiers` ADD CONSTRAINT `fk_leave_seniority_tiers_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- holidays
ALTER TABLE `holidays` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `holidays` ADD INDEX `idx_holidays_company` (`company_id`);
ALTER TABLE `holidays` ADD CONSTRAINT `fk_holidays_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- news_articles
ALTER TABLE `news_articles` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `news_articles` ADD INDEX `idx_news_articles_company` (`company_id`);
ALTER TABLE `news_articles` ADD CONSTRAINT `fk_news_articles_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- work_locations
ALTER TABLE `work_locations` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `work_locations` ADD INDEX `idx_work_locations_company` (`company_id`);
ALTER TABLE `work_locations` ADD CONSTRAINT `fk_work_locations_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- faq
ALTER TABLE `faq` ADD COLUMN `company_id` INT NOT NULL DEFAULT 1 AFTER `id`;
ALTER TABLE `faq` ADD INDEX `idx_faq_company` (`company_id`);
ALTER TABLE `faq` ADD CONSTRAINT `fk_faq_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`);

-- ============================================================
-- 4. Add is_superadmin column for cross-company admin access
-- ============================================================
ALTER TABLE `employees` ADD COLUMN `is_superadmin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_admin`;
