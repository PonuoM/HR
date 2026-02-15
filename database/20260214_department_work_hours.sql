-- Add work hours to departments
ALTER TABLE `departments` 
  ADD COLUMN `work_start_time` TIME NOT NULL DEFAULT '09:00:00' AFTER `name`,
  ADD COLUMN `work_end_time` TIME NOT NULL DEFAULT '17:00:00' AFTER `work_start_time`,
  ADD COLUMN `work_hours_per_day` DECIMAL(4,2) NOT NULL DEFAULT 8.00 AFTER `work_end_time`;

-- Set specific hours per department
-- ฝ่ายไอที (id=1): 09:00-18:00 = 9 hours
UPDATE `departments` SET work_start_time='09:00:00', work_end_time='18:00:00', work_hours_per_day=9.00 WHERE id=1;
-- ฝ่ายการตลาด (id=2): 09:00-18:00 = 9 hours  
UPDATE `departments` SET work_start_time='09:00:00', work_end_time='18:00:00', work_hours_per_day=9.00 WHERE id=2;
-- ฝ่ายบัญชี (id=3): 09:00-17:00 = 8 hours (default)
-- ฝ่ายบุคคล (id=4): 09:00-17:00 = 8 hours (default)
-- ฝ่ายขาย (id=5): 09:00-18:00 = 9 hours
UPDATE `departments` SET work_start_time='09:00:00', work_end_time='18:00:00', work_hours_per_day=9.00 WHERE id=5;
-- ฝ่ายทรัพยากรบุคคล (id=6): 09:00-17:00 = 8 hours (default)

-- Change total_days to DECIMAL for partial day support (ลา 1 ชม. = 0.125 วัน for 8hr dept)
ALTER TABLE `leave_requests` MODIFY COLUMN `total_days` DECIMAL(5,2) DEFAULT 1.00;
ALTER TABLE `leave_quotas` MODIFY COLUMN `total` DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE `leave_quotas` MODIFY COLUMN `used` DECIMAL(5,2) DEFAULT 0.00;
