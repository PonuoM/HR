-- =====================================================
-- Migration: Audit log for HR-deleted leave_requests
-- Date: 2026-05-20
-- Notes:
--   - HR/superadmin can delete leave_requests in any status.
--   - Full row is snapshotted as JSON (LONGTEXT) before delete.
--   - Quota auto-recovers because quota reads from leave_requests.
--   - Employee self-cancel of pending requests bypasses this log
--     (existing flow — no audit needed for own pending).
-- =====================================================

CREATE TABLE IF NOT EXISTS `leave_request_deletions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `original_request_id` INT NOT NULL,
  `employee_id` VARCHAR(20) NOT NULL,
  `company_id` INT DEFAULT NULL,
  `snapshot` LONGTEXT NOT NULL,
  `deleted_by` VARCHAR(20) DEFAULT NULL,
  `deleted_at` DATETIME NOT NULL,
  `reason` TEXT NOT NULL,
  INDEX `idx_lrd_employee` (`employee_id`),
  INDEX `idx_lrd_deleted_by` (`deleted_by`),
  INDEX `idx_lrd_deleted_at` (`deleted_at`),
  INDEX `idx_lrd_company` (`company_id`),
  CONSTRAINT `lrd_deleted_by_fk`
    FOREIGN KEY (`deleted_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
