-- Seed Data: Initial HR Department, Position, and Admin Employee
-- Run via: https://hr.prima49.com/database/run_migration.php?key=prima49migrate

-- Insert HR department
INSERT INTO `departments` (`id`, `name`, `work_start_time`, `work_end_time`, `work_hours_per_day`, `is_admin_system`)
VALUES (1, 'ฝ่ายบุคคล (HR)', '09:00:00', '17:00:00', 8.00, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Insert HR Manager position
INSERT INTO `positions` (`id`, `name`, `can_have_subordinates`)
VALUES (1, 'HR Manager', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Insert Admin Employee
-- ID: HR001, Password: 1234 (bcrypt hashed), Admin: YES
INSERT INTO `employees` (`id`, `name`, `email`, `password`, `department_id`, `position_id`, `employment_type`, `is_admin`, `is_active`, `hire_date`)
VALUES ('HR001', 'Admin HR', 'hr@prima49.com', '$2y$10$/N1gJR7GRNiajcW44l/pbeTpFdJZrTFdTRaRQpDReGLagLKvSB7hW', 1, 1, 'พนักงานประจำ', 1, 1, '2026-02-15')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
