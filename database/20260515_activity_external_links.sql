-- =====================================================
-- Migration: External-link activities + audience control
-- Date: 2026-05-15
-- Notes:
--   - external_url: when set, the activity renders as an outbound link
--     (opens new tab) instead of navigating to an internal route.
--   - audience: 'all' = visible to every employee, 'admin' = admin only.
--   - Adds 2 default external links for asset.prima49.com integration:
--       asset_management  → admin-only back-office withdrawal page
--       material_request  → user-facing material request form
-- =====================================================

ALTER TABLE `activity_settings`
  ADD COLUMN `external_url` VARCHAR(500) DEFAULT NULL AFTER `icon`,
  ADD COLUMN `audience` ENUM('all','admin') NOT NULL DEFAULT 'all' AFTER `external_url`;

-- Seed the two asset-system links for every existing company.
INSERT IGNORE INTO `activity_settings`
  (company_id, activity_key, enabled, label, description, icon, external_url, audience, sort_order)
SELECT id, 'asset_management', 1,
       'ระบบการเบิก',
       'จัดการระบบเบิกวัสดุ (สำหรับแอดมินหลังบ้าน)',
       'inventory_2',
       'https://asset.prima49.com/index.php',
       'admin',
       10
FROM companies;

INSERT IGNORE INTO `activity_settings`
  (company_id, activity_key, enabled, label, description, icon, external_url, audience, sort_order)
SELECT id, 'material_request', 1,
       'เบิกวัสดุ',
       'ขอเบิกวัสดุสิ้นเปลือง',
       'shopping_cart',
       'https://asset.prima49.com/user_request.php',
       'all',
       11
FROM companies;
