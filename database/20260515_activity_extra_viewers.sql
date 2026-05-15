-- =====================================================
-- Migration: per-activity extra viewers (allow non-admin access)
-- Date: 2026-05-15
-- Notes:
--   - audience='admin' on activity_settings restricts a quick-button to
--     admins. This table grants exceptions: specific non-admin employees
--     who should also see + use the link.
--   - Visibility rule (frontend): visible IF audience='all'
--     OR user.is_admin OR user.id IN (activity_extra_viewers).
--   - One row per (activity, employee). FK cascades on activity delete
--     so we never leak orphan viewer rows.
-- =====================================================

CREATE TABLE IF NOT EXISTS `activity_extra_viewers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `activity_id` INT NOT NULL,
  `employee_id` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_act_emp` (`activity_id`, `employee_id`),
  INDEX `idx_employee` (`employee_id`),
  CONSTRAINT `fk_extra_act`
    FOREIGN KEY (`activity_id`) REFERENCES `activity_settings`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
