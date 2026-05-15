-- Rename บริษัทพรีม่าเวล (company_id=3) employee IDs to PMW#### format
-- Existing: PMW0001 (ภัณฑิรา) → keep
-- Renaming (in current ID order, which is also hire_date order):
--   0033 → PMW0002  (ทินกร)
--   0051 → PMW0003  (สุจิรา)
--   0097 → PMW0004  (วนิดา)
--   0101 → PMW0005  (สุภาพร)
--   0102 → PMW0006  (ฉัตรแก้ว)
--   0106 → PMW0007  (อนุสรา)
--   0128 → PMW0008  (แก้วเพชรพลอย)
--   0156 → PMW0009  (ศิรินี)
--   0157 → PMW0010  (สุจิตรา)
--   0158 → PMW0011  (เกศินี)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
START TRANSACTION;

-- 1) employees PK rename
UPDATE employees SET id = CASE id
    WHEN '0033' THEN 'PMW0002'
    WHEN '0051' THEN 'PMW0003'
    WHEN '0097' THEN 'PMW0004'
    WHEN '0101' THEN 'PMW0005'
    WHEN '0102' THEN 'PMW0006'
    WHEN '0106' THEN 'PMW0007'
    WHEN '0128' THEN 'PMW0008'
    WHEN '0156' THEN 'PMW0009'
    WHEN '0157' THEN 'PMW0010'
    WHEN '0158' THEN 'PMW0011'
END
WHERE id IN ('0033','0051','0097','0101','0102','0106','0128','0156','0157','0158');

-- 2) self-ref: approver_id of 9 new staff currently '0033' → 'PMW0002'
UPDATE employees SET approver_id = 'PMW0002' WHERE approver_id = '0033';
UPDATE employees SET approver2_id = 'PMW0002' WHERE approver2_id = '0033';

-- 3) leave_quotas (only ทินกร has rows: 5)
UPDATE leave_quotas SET employee_id = 'PMW0002' WHERE employee_id = '0033';

-- 4) active_sessions
UPDATE active_sessions SET employee_id = 'PMW0002' WHERE employee_id = '0033';

-- 5) security_alerts (two cols)
UPDATE security_alerts SET employee_id = 'PMW0002' WHERE employee_id = '0033';
UPDATE security_alerts SET original_employee_id = 'PMW0002' WHERE original_employee_id = '0033';

-- 6) uploads (avatar related_id)
UPDATE uploads SET related_id = 'PMW0002' WHERE category='avatar' AND related_id='0033';

COMMIT;
SET FOREIGN_KEY_CHECKS=1;
