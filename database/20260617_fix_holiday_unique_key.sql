-- ============================================================
-- Fix Holidays Table Unique Index for Multi-Company
-- Date: 2026-06-17
-- Description: Drop uq_date unique key and create uq_company_date unique key
-- ============================================================

ALTER TABLE `holidays` DROP INDEX `uq_date`;
ALTER TABLE `holidays` ADD UNIQUE KEY `uq_company_date` (`company_id`, `date`);
