-- =====================================================
-- HR Mobile Connect — Production Database Setup
-- Database: primacom_hr_mobile_connect
-- Host: localhost
-- Username: primacom_bloguser
-- Password: pJnL53Wkhju2LaGPytw8
-- 
-- วิธีใช้: Import ผ่าน phpMyAdmin หรือ command line
-- Generated from local structure: 2026-02-15
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- =====================================================
-- ลำดับสำคัญ: สร้าง table ที่ไม่มี FK ก่อน
-- departments → positions → employees → (ที่เหลือ)
-- =====================================================

-- --------------------------------------------------------
-- 1. departments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `departments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `work_start_time` time NOT NULL DEFAULT '09:00:00',
  `work_end_time` time NOT NULL DEFAULT '17:00:00',
  `work_hours_per_day` decimal(4,2) NOT NULL DEFAULT '8.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_admin_system` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. positions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `positions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `can_have_subordinates` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. employees (FK → departments, positions, self-reference)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employees` (
  `id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '$2y$10$defaulthash',
  `department_id` int(11) DEFAULT NULL,
  `position_id` int(11) DEFAULT NULL,
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employment_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'พนักงานประจำ',
  `base_salary` decimal(10,2) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `is_admin` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `terminated_at` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approver_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approver2_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `department_id` (`department_id`),
  KEY `position_id` (`position_id`),
  KEY `fk_approver` (`approver_id`),
  KEY `fk_approver2` (`approver2_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. leave_types
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leave_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_quota` int(11) DEFAULT '0',
  `unit` enum('days','hours') COLLATE utf8mb4_unicode_ci DEFAULT 'days',
  `type` enum('annual','seniority','lifetime','unpaid') COLLATE utf8mb4_unicode_ci DEFAULT 'annual',
  `reset_cycle` enum('year','never') COLLATE utf8mb4_unicode_ci DEFAULT 'year',
  `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'blue',
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'star',
  `icon_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `requires_doc` tinyint(1) DEFAULT '0',
  `probation_months` int(11) DEFAULT '0',
  `grant_timing` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'next_year',
  `prorate_first_year` tinyint(1) DEFAULT '1',
  `advance_notice_days` int(11) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. work_locations
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `work_locations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `radius_meters` int(11) DEFAULT '200',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. attendance (FK → employees)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `clock_in` time DEFAULT NULL,
  `clock_out` time DEFAULT NULL,
  `location` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `is_offsite` tinyint(1) DEFAULT '0',
  `location_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clock_out_latitude` decimal(10,7) DEFAULT NULL,
  `clock_out_longitude` decimal(10,7) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employee_date` (`employee_id`,`date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. faq
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `faq` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `question` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `answer` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int(11) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. holidays
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `holidays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `year` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 9. leave_quotas (FK → employees, leave_types)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leave_quotas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `leave_type_id` int(11) NOT NULL,
  `total` decimal(5,2) DEFAULT '0.00',
  `used` decimal(5,2) DEFAULT '0.00',
  `year` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employee_type_year` (`employee_id`,`leave_type_id`,`year`),
  KEY `leave_type_id` (`leave_type_id`),
  CONSTRAINT `leave_quotas_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_quotas_ibfk_2` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 10. leave_requests (FK → employees, leave_types)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `leave_type_id` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` decimal(5,2) DEFAULT '1.00',
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `approved_by` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `tier1_status` enum('pending','approved','rejected','skipped') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `tier1_by` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier1_at` timestamp NULL DEFAULT NULL,
  `tier2_status` enum('pending','approved','rejected','skipped') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `tier2_by` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier2_at` timestamp NULL DEFAULT NULL,
  `is_bypass` tinyint(1) DEFAULT '0',
  `expected_approver1_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expected_approver2_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `leave_type_id` (`leave_type_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_requests_ibfk_2` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 11. leave_seniority_tiers (FK → leave_types)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leave_seniority_tiers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `leave_type_id` int(11) NOT NULL,
  `min_years` int(11) NOT NULL,
  `days` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_type_years` (`leave_type_id`,`min_years`),
  CONSTRAINT `leave_seniority_tiers_ibfk_1` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 12. news_articles (FK → employees)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `news_articles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_pinned` tinyint(1) DEFAULT '0',
  `is_urgent` tinyint(1) DEFAULT '0',
  `author_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `views` int(11) DEFAULT '0',
  `likes` int(11) DEFAULT '0',
  `comments_count` int(11) DEFAULT '0',
  `published_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `news_articles_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 13. notifications (FK → employees)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'notifications',
  `icon_bg` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'bg-blue-100 text-blue-600',
  `type` enum('leave','payslip','news','system') COLLATE utf8mb4_unicode_ci DEFAULT 'system',
  `icon_color` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'text-blue-600',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 14. payslips (FK → employees)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payslips` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `month` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `year` varchar(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('new','read') COLLATE utf8mb4_unicode_ci DEFAULT 'new',
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `payslips_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 15. time_records (FK → employees, work_locations)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `time_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_date` date NOT NULL,
  `clock_in_time` time NOT NULL,
  `clock_out_time` time DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `approved_by` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `location_id` (`location_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `time_records_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `time_records_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `work_locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `time_records_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 16. uploads
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `uploads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int(11) DEFAULT '0',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `related_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_by` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_related` (`category`,`related_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- FK สำหรับ employees (ต้อง ADD หลังสุดเพราะ self-ref + FK ข้ามตาราง)
-- --------------------------------------------------------
ALTER TABLE `employees`
  ADD CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employees_ibfk_2` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_approver` FOREIGN KEY (`approver_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_approver2` FOREIGN KEY (`approver2_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
