-- ============================================
-- HR Mobile Connect - Fix Missing Tables/Columns
-- Run on production: primacom_hr_mobile_connect
-- Date: 2026-02-16
-- ============================================

-- 1. Create approval_tracking table
CREATE TABLE IF NOT EXISTS approval_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_type ENUM('leave', 'overtime', 'expense') NOT NULL DEFAULT 'leave',
    request_id INT NOT NULL,
    approver_id VARCHAR(20) NOT NULL,
    approver_level TINYINT NOT NULL DEFAULT 1,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    comment TEXT NULL,
    acted_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request (request_type, request_id),
    INDEX idx_approver (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add phone column to employees (if not exists)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL AFTER email;
