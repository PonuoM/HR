-- ============================================================
-- Security Enhancement: Device Binding + Sessions + Face Recognition
-- Run this migration on your database server
-- ============================================================

-- Layer 1: Device Binding (on employees table)
ALTER TABLE employees ADD COLUMN device_fingerprint VARCHAR(255) DEFAULT NULL;
ALTER TABLE employees ADD COLUMN device_registered_at DATETIME DEFAULT NULL;

-- Layer 2: Active Sessions
CREATE TABLE IF NOT EXISTS active_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  session_token VARCHAR(64) NOT NULL,
  device_fingerprint VARCHAR(255) DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_token (session_token),
  INDEX idx_employee (employee_id),
  INDEX idx_fingerprint (device_fingerprint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Layer 1 supplement: Security alerts table (for suspicious device usage)
CREATE TABLE IF NOT EXISTS security_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alert_type ENUM('device_shared', 'session_hijack', 'face_mismatch', 'other') NOT NULL DEFAULT 'other',
  employee_id VARCHAR(20) NOT NULL COMMENT 'Who triggered the alert',
  original_employee_id VARCHAR(20) DEFAULT NULL COMMENT 'Device owner (for device_shared alerts)',
  device_fingerprint VARCHAR(255) DEFAULT NULL,
  details TEXT,
  is_resolved TINYINT(1) DEFAULT 0,
  resolved_by VARCHAR(20) DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (alert_type),
  INDEX idx_resolved (is_resolved),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Layer 5: Face Recognition (on employees table)
ALTER TABLE employees ADD COLUMN face_descriptor TEXT DEFAULT NULL;
ALTER TABLE employees ADD COLUMN face_registered_at DATETIME DEFAULT NULL;
