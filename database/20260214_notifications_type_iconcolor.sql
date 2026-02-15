-- =====================================================
-- Migration: 20260214 - Add type and icon_color to notifications
-- =====================================================

ALTER TABLE `notifications`
  ADD COLUMN `type` ENUM('leave','payslip','news','system') DEFAULT 'system' AFTER `icon_bg`,
  ADD COLUMN `icon_color` VARCHAR(100) DEFAULT 'text-blue-600' AFTER `type`;

-- Backfill existing data
UPDATE `notifications` SET `type` = 'leave', `icon_color` = 'text-green-600' WHERE `icon` = 'check_circle';
UPDATE `notifications` SET `type` = 'payslip', `icon_color` = 'text-blue-600' WHERE `icon` = 'receipt_long';
UPDATE `notifications` SET `type` = 'news', `icon_color` = 'text-orange-600' WHERE `icon` = 'celebration';
