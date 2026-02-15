-- Update all employees to use bcrypt hash of '1234' as default password
-- Generated with: php -r "echo password_hash('1234', PASSWORD_BCRYPT);"
UPDATE employees SET password = '$2y$10$Vc9aFCQvhjDm81hC86nztuuQ2t2sMYJurZDE.NwCSAjHntT7d2l50G'
WHERE password = '$2y$10$defaulthash';
