-- =====================================================
-- HR Mobile Connect - Database Schema
-- MySQL / MariaDB 10.6+
-- =====================================================

CREATE DATABASE IF NOT EXISTS `hr_mobile_connect`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `hr_mobile_connect`;

-- Drop existing tables (disable FK checks for clean re-run)
SET FOREIGN_KEY_CHECKS = 0;
-- Legacy tables from old schemas (drop children first)
DROP TABLE IF EXISTS `news_interactions`;
DROP TABLE IF EXISTS `news_comments`;
DROP TABLE IF EXISTS `news_posts`;
DROP TABLE IF EXISTS `users`;
-- Current tables
DROP TABLE IF EXISTS `faq`;
DROP TABLE IF EXISTS `attendance`;
DROP TABLE IF EXISTS `payslips`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `leave_requests`;
DROP TABLE IF EXISTS `leave_quotas`;
DROP TABLE IF EXISTS `news_articles`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `positions`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `leave_types`;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 1. departments
-- =====================================================
CREATE TABLE `departments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `departments` (`name`) VALUES
('ฝ่ายไอที'),
('ฝ่ายการตลาด'),
('ฝ่ายบัญชี'),
('ฝ่ายบุคคล'),
('ฝ่ายขาย'),
('ฝ่ายทรัพยากรบุคคล');

-- =====================================================
-- 2. positions
-- =====================================================
CREATE TABLE `positions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `positions` (`name`) VALUES
('Software Engineer'),
('Marketing Manager'),
('Accountant'),
('HR Specialist'),
('Sales Executive'),
('Team Lead'),
('ผู้จัดการฝ่ายการตลาด');

-- =====================================================
-- 3. employees
-- =====================================================
CREATE TABLE `employees` (
  `id` VARCHAR(20) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL DEFAULT '$2y$10$defaulthash',
  `department_id` INT DEFAULT NULL,
  `position_id` INT DEFAULT NULL,
  `avatar` VARCHAR(500) DEFAULT NULL,
  `employment_type` VARCHAR(50) DEFAULT 'พนักงานประจำ',
  `base_salary` DECIMAL(10,2) DEFAULT NULL,
  `hire_date` DATE DEFAULT NULL,
  `is_admin` TINYINT(1) DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO `employees` (`id`, `name`, `department_id`, `position_id`, `avatar`, `is_admin`, `employment_type`, `password`) VALUES
('EMP001', 'สาระ วิลสัน', 1, 1, 'https://picsum.photos/id/64/200/200', 1, 'พนักงานประจำ', '$2y$10$defaulthash'),
('EMP002', 'สมศรี มีสุข', 2, 2, 'https://picsum.photos/id/51/40/40', 0, 'พนักงานประจำ', '$2y$10$defaulthash'),
('EMP003', 'ประยุทธ์ จันทร์', 3, 3, 'https://picsum.photos/id/52/40/40', 0, 'พนักงานประจำ', '$2y$10$defaulthash'),
('EMP004', 'มณีรัตน์ แก้ว', 4, 4, 'https://picsum.photos/id/53/40/40', 0, 'พนักงานประจำ', '$2y$10$defaulthash'),
('EMP005', 'สมชาย ใจดี', 2, 7, 'https://picsum.photos/id/237/200/200', 0, 'พนักงานประจำ', '$2y$10$defaulthash');

-- =====================================================
-- 4. leave_types
-- =====================================================
CREATE TABLE `leave_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `default_quota` INT DEFAULT 0,
  `unit` ENUM('days','hours') DEFAULT 'days',
  `type` ENUM('annual','seniority','lifetime','unpaid') DEFAULT 'annual',
  `reset_cycle` ENUM('year','never') DEFAULT 'year',
  `color` VARCHAR(20) DEFAULT 'blue',
  `icon` VARCHAR(50) DEFAULT 'star',
  `icon_url` VARCHAR(500) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `requires_doc` TINYINT(1) DEFAULT 0,
  `probation_months` INT DEFAULT 0,
  `grant_timing` VARCHAR(20) DEFAULT 'next_year',
  `prorate_first_year` TINYINT(1) DEFAULT 1,
  `advance_notice_days` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `leave_types` (`name`, `default_quota`, `unit`, `type`, `reset_cycle`, `color`, `icon`, `is_active`, `requires_doc`) VALUES
('ลาพักร้อน (Vacation)', 6, 'days', 'seniority', 'year', 'orange', 'beach_access', 1, 0),
('ลาป่วย (Sick Leave)', 30, 'days', 'annual', 'year', 'green', 'local_hospital', 1, 1),
('ลากิจ (Business)', 3, 'days', 'annual', 'year', 'blue', 'business_center', 1, 0),
('ลาทำหมัน (Sterilization)', 1, 'days', 'lifetime', 'never', 'pink', 'pregnant_woman', 1, 1),
('ลาไม่รับค่าจ้าง (No Pay)', 0, 'days', 'unpaid', 'year', 'gray', 'money_off', 1, 0);

-- =====================================================
-- 4b. leave_seniority_tiers (for seniority-type leave)
-- =====================================================
CREATE TABLE `leave_seniority_tiers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `leave_type_id` INT NOT NULL,
  `min_years` INT NOT NULL,
  `days` INT NOT NULL,
  UNIQUE KEY `uq_type_years` (`leave_type_id`, `min_years`),
  FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO `leave_seniority_tiers` (`leave_type_id`, `min_years`, `days`) VALUES
(1, 1, 6), (1, 3, 8), (1, 5, 10), (1, 10, 15);

-- =====================================================
-- 5. leave_quotas (per employee per leave type)
-- =====================================================
CREATE TABLE `leave_quotas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(20) NOT NULL,
  `leave_type_id` INT NOT NULL,
  `total` INT DEFAULT 0,
  `used` INT DEFAULT 0,
  `year` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_employee_type_year` (`employee_id`, `leave_type_id`, `year`),
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO `leave_quotas` (`employee_id`, `leave_type_id`, `total`, `used`, `year`) VALUES
('EMP001', 1, 15, 3, 2024),
('EMP001', 2, 7, 2, 2024),
('EMP001', 3, 5, 3, 2024);

-- =====================================================
-- 6. leave_requests
-- =====================================================
CREATE TABLE `leave_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(20) NOT NULL,
  `leave_type_id` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `total_days` INT DEFAULT 1,
  `reason` TEXT DEFAULT NULL,
  `status` ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `approved_by` VARCHAR(20) DEFAULT NULL,
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO `leave_requests` (`employee_id`, `leave_type_id`, `start_date`, `end_date`, `total_days`, `reason`, `status`) VALUES
('EMP002', 2, '2024-10-24', '2024-10-25', 2, 'มีอาการไข้สูงและปวดศีรษะ แพทย์แนะนำให้พักผ่อน', 'pending'),
('EMP003', 2, '2024-10-24', '2024-10-25', 2, 'มีอาการไข้สูงและปวดศีรษะ แพทย์แนะนำให้พักผ่อน', 'pending'),
('EMP004', 2, '2024-10-24', '2024-10-25', 2, 'มีอาการไข้สูงและปวดศีรษะ แพทย์แนะนำให้พักผ่อน', 'pending'),
('EMP001', 1, '2024-10-24', '2024-10-26', 3, 'พักผ่อนส่วนตัว', 'pending');

-- =====================================================
-- 7. notifications
-- =====================================================
CREATE TABLE `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(20) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `icon` VARCHAR(50) DEFAULT 'notifications',
  `icon_bg` VARCHAR(100) DEFAULT 'bg-blue-100 text-blue-600',
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO `notifications` (`employee_id`, `title`, `message`, `icon`, `icon_bg`, `is_read`) VALUES
('EMP001', 'คำขอลาอนุมัติแล้ว', 'คำขอลาพักร้อนวันที่ 1-3 พ.ย. ได้รับการอนุมัติ', 'check_circle', 'bg-green-100 dark:bg-green-900/30 text-green-600', 0),
('EMP001', 'สลิปเงินเดือน', 'สลิปเงินเดือนเดือนตุลาคมพร้อมดูแล้ว', 'receipt_long', 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', 0),
('EMP001', 'ประชาสัมพันธ์', 'งานเลี้ยงปีใหม่ 20 ธ.ค. ลงทะเบียนได้แล้ว', 'celebration', 'bg-orange-100 dark:bg-orange-900/30 text-orange-600', 1);

-- =====================================================
-- 8. news_articles
-- =====================================================
CREATE TABLE `news_articles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(300) NOT NULL,
  `content` TEXT NOT NULL,
  `image` VARCHAR(500) DEFAULT NULL,
  `department` VARCHAR(100) DEFAULT NULL,
  `department_code` VARCHAR(10) DEFAULT NULL,
  `is_pinned` TINYINT(1) DEFAULT 0,
  `is_urgent` TINYINT(1) DEFAULT 0,
  `author_id` VARCHAR(20) DEFAULT NULL,
  `views` INT DEFAULT 0,
  `likes` INT DEFAULT 0,
  `comments_count` INT DEFAULT 0,
  `published_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`author_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO `news_articles` (`title`, `content`, `image`, `department`, `department_code`, `is_pinned`, `is_urgent`, `views`, `likes`, `comments_count`) VALUES
('กำหนดการงานเลี้ยงปีใหม่ประจำปี 2024 และกิจกรรมจับฉลากของขวัญ', 'ขอเชิญเพื่อนพนักงานทุกท่านเข้าร่วมงานเลี้ยงสังสรรค์ส่งท้ายปีเก่าต้อนรับปีใหม่ ในธีม Neon Galaxy...', 'https://picsum.photos/200/200?random=1', 'ฝ่ายทรัพยากรบุคคล', 'HR', 1, 1, 245, 128, 42),
('ประกาศวันหยุดสงกรานต์', 'เรียนพนักงานทุกท่าน บริษัทขอประกาศวันหยุดเนื่องในเทศกาลสงกรานต์ ตั้งแต่วันที่ 13-16 เมษายน นี้ เพื่อให้พนักงานได้กลับภูมิลำเนา...', 'https://picsum.photos/600/400?random=2', 'ฝ่ายทรัพยากรบุคคล', 'HR', 0, 0, 120, 56, 8),
('แจ้งปิดปรับปรุงระบบเซิร์ฟเวอร์', 'จะมีการปิดปรับปรุงระบบในวันเสาร์ที่ 20 นี้ เวลา 22:00 - 02:00 น. เพื่อทำการอัปเกรดความปลอดภัย ขออภัยในความไม่สะดวก', '', 'ฝ่ายไอที', 'IT', 0, 0, 80, 24, 3);

-- =====================================================
-- 9. payslips
-- =====================================================
CREATE TABLE `payslips` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(20) NOT NULL,
  `month` VARCHAR(20) NOT NULL,
  `year` VARCHAR(4) NOT NULL,
  `amount` VARCHAR(20) NOT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('new','read') DEFAULT 'new',
  `sent_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO `payslips` (`employee_id`, `month`, `year`, `amount`, `image_url`, `status`, `sent_at`) VALUES
('EMP001', 'ตุลาคม', '2024', '55,000.00', 'https://picsum.photos/600/800?random=101', 'new', '2024-10-25 10:00:00'),
('EMP001', 'กันยายน', '2024', '55,000.00', 'https://picsum.photos/600/800?random=102', 'read', '2024-09-25 10:00:00'),
('EMP001', 'สิงหาคม', '2024', '55,000.00', 'https://picsum.photos/600/800?random=103', 'read', '2024-08-25 10:00:00'),
('EMP001', 'กรกฎาคม', '2024', '54,000.00', 'https://picsum.photos/600/800?random=104', 'read', '2024-07-25 10:00:00'),
('EMP002', 'กันยายน', '2024', '48,000.00', 'https://picsum.photos/600/800?random=202', 'read', '2024-09-25 10:00:00');

-- =====================================================
-- 10. attendance
-- =====================================================
CREATE TABLE `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(20) NOT NULL,
  `date` DATE NOT NULL,
  `clock_in` TIME DEFAULT NULL,
  `clock_out` TIME DEFAULT NULL,
  `location` VARCHAR(200) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_employee_date` (`employee_id`, `date`),
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO `attendance` (`employee_id`, `date`, `clock_in`, `clock_out`, `location`) VALUES
('EMP001', '2024-10-24', '08:45:00', NULL, 'สำนักงานกรุงเทพฯ'),
('EMP001', '2024-10-23', '08:30:00', '18:00:00', 'สำนักงานกรุงเทพฯ');

-- =====================================================
-- FAQ (static reference table)
-- =====================================================
CREATE TABLE `faq` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `question` TEXT NOT NULL,
  `answer` TEXT NOT NULL,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `faq` (`question`, `answer`, `sort_order`) VALUES
('ฉันจะแก้ไขข้อมูลส่วนตัวได้อย่างไร?', 'คุณสามารถติดต่อฝ่าย HR เพื่อขอแก้ไขข้อมูลสำคัญ หรือแก้ไขข้อมูลเบื้องต้นได้ที่หน้าโปรไฟล์ > แก้ไข', 1),
('การอนุมัติวันลาใช้เวลานานเท่าไหร่?', 'โดยปกติหัวหน้างานจะอนุมัติภายใน 24 ชม. และ HR จะตรวจสอบภายใน 1-2 วันทำการ', 2),
('ลืมลงเวลาเข้างานต้องทำอย่างไร?', 'ให้ทำการ "ขอลงเวลาย้อนหลัง" ในเมนูคำขอ พร้อมระบุเหตุผลเพื่อให้หัวหน้างานอนุมัติ', 3);

-- =====================================================
-- 12. uploads (centralized file storage)
-- =====================================================
CREATE TABLE `uploads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `filename` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) DEFAULT NULL,
  `file_size` INT DEFAULT 0,
  `category` VARCHAR(50) DEFAULT 'general',
  `related_id` VARCHAR(50) DEFAULT NULL,
  `uploaded_by` VARCHAR(20) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_related` (`category`, `related_id`)
) ENGINE=InnoDB;
