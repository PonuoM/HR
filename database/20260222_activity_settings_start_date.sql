-- =====================================================
-- Migration: Activity Settings + Attendance Alerts
-- Date: 2026-02-22
-- Description: 
--   1. Create activity_settings table (if not exists)
--   2. Seed default activities
-- =====================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS activity_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    activity_key VARCHAR(50) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    label VARCHAR(100) NOT NULL,
    description VARCHAR(255) DEFAULT '',
    icon VARCHAR(50) DEFAULT 'extension',
    sort_order INT DEFAULT 0,
    start_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_company_activity (company_id, activity_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Seed default activities (company_id = 1)
INSERT IGNORE INTO activity_settings (company_id, activity_key, enabled, label, description, icon, sort_order)
VALUES 
    (1, 'employee_vote', 1, 'โหวตพนักงานดีเด่น', 'ระบบโหวตพนักงานดีเด่นประจำเดือน', 'emoji_events', 1),
    (1, 'attendance_check', 0, 'ตรวจสอบการลงเวลา', 'แจ้งเตือนเมื่อพนักงานไม่ได้ลงเวลาหรือลงไม่ครบ (จ-ศ)', 'schedule', 2);

-- Verify
SELECT * FROM activity_settings ORDER BY company_id, sort_order;
