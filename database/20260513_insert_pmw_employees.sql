-- Insert 9 new employees for บริษัท พรีม่า เวล (company_id=3)
-- Per request 2026-05-13:
--   - ID format: 4-digit zero-padded
--   - Position: Staff (id=18) ทุกคน
--   - Department: เทเลเซลล์ → Telesale (33), อื่นๆ (การตลาด*) → Online Marketing (27)
--   - Approver stage 1: 0033 ทินกร ขำจีน
--   - Approver stage 2: HR001 อรนิชชา
--   - Email: ชื่อจริง (Romanized) @gmail.com
--   - Password: 1234 (bcrypt) — เปลี่ยนได้ภายหลัง
--   - employment_type: พนักงานประจำ

SET NAMES utf8mb4;

INSERT INTO employees
    (id, company_id, name, nickname, email, password,
     department_id, position_id, employment_type,
     hire_date, is_admin, is_active, approver_id, approver2_id)
VALUES
    ('0051', 3, 'สุจิรา บุญธรรม',        'เมย์',  'sujira@gmail.com',       '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 27, 18, 'พนักงานประจำ', '2025-03-03', 0, 1, '0033', 'HR001'),
    ('0097', 3, 'วนิดา มัฐผา',           'กวาง',  'wanida@gmail.com',       '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 33, 18, 'พนักงานประจำ', '2025-11-05', 0, 1, '0033', 'HR001'),
    ('0101', 3, 'สุภาพร แสงชมภู',         'อ้อม',  'supaporn@gmail.com',     '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 33, 18, 'พนักงานประจำ', '2025-11-07', 0, 1, '0033', 'HR001'),
    ('0102', 3, 'ฉัตรแก้ว เจริญสุข',      'ฝ้าย',  'chatkaew@gmail.com',     '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 27, 18, 'พนักงานประจำ', '2025-12-01', 0, 1, '0033', 'HR001'),
    ('0106', 3, 'อนุสรา พาเขียน',         'แอน',   'anusara@gmail.com',      '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 27, 18, 'พนักงานประจำ', '2026-02-02', 0, 1, '0033', 'HR001'),
    ('0128', 3, 'แก้วเพชรพลอย ลอสี',      'แอน',   'kaewphetploy@gmail.com', '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 33, 18, 'พนักงานประจำ', '2026-04-01', 0, 1, '0033', 'HR001'),
    ('0156', 3, 'ศิรินี เข็มทอง',          'มิ้ว',  'sirinee@gmail.com',      '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 33, 18, 'พนักงานประจำ', '2026-04-20', 0, 1, '0033', 'HR001'),
    ('0157', 3, 'สุจิตรา สิทธิพูลทอง',     'นุ่น',  'sujitra@gmail.com',      '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 33, 18, 'พนักงานประจำ', '2026-04-20', 0, 1, '0033', 'HR001'),
    ('0158', 3, 'เกศินี อินทะวาส',         'หญิง',  'kasinee@gmail.com',      '$2y$10$xGVxyWiTYpzrEjBg3qEzXuVxHoDBFSQhkKoZWyIyQEpTs9/ChFN5C', 27, 18, 'พนักงานประจำ', '2026-04-30', 0, 1, '0033', 'HR001');
