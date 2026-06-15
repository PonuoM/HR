-- 2026-06-15: Extra working-day overrides ("วันทำงานพิเศษ")
-- The positive counterpart of `holidays`. Marks a normally-off day (typically an
-- irregular Saturday) as a WORKING day so the schedule becomes deterministic:
-- on a marked day, leave counts as real leave, attendance counts as present, and
-- a no-show counts as absent. Unmarked off-days stay weekend.
--
-- scope:
--   company    → applies to every employee in the company
--   department → applies to one department (department_id)
--   employee   → applies to one employee (employee_id)
-- Multiple rows can target the same date at different scopes (mixed assignment).

CREATE TABLE IF NOT EXISTS work_day_overrides (
  id INT(11) NOT NULL AUTO_INCREMENT,
  company_id INT(11) NOT NULL DEFAULT 1,
  date DATE NOT NULL,
  scope ENUM('company','department','employee') NOT NULL DEFAULT 'company',
  department_id INT(11) NULL,
  employee_id VARCHAR(20) NULL,
  note VARCHAR(200) NULL,
  created_by VARCHAR(20) NULL,
  created_at TIMESTAMP NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_lookup (company_id, date),
  KEY idx_dept (department_id),
  KEY idx_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
