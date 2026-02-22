-- ============================================================
-- Migration: Add birth_date column to employees table
-- Run on production BEFORE deploying the new code
-- ============================================================

ALTER TABLE employees ADD COLUMN birth_date DATE DEFAULT NULL AFTER hire_date;
