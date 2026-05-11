<?php
/**
 * Database credentials template.
 *
 * SETUP:
 *   1. Copy this file to api/.db-secrets.php
 *   2. Fill in your real DB credentials below
 *   3. .db-secrets.php is gitignored — never commit it
 *
 * ALTERNATIVE: Set environment variables instead (preferred for production):
 *   - HR_DB_HOST   (default: 'localhost' on production, required on dev)
 *   - HR_DB_USER
 *   - HR_DB_PASS
 *   - HR_DB_NAME
 *
 * On Apache: add to vhost or .htaccess:
 *   SetEnv HR_DB_HOST localhost
 *   SetEnv HR_DB_USER your_user
 *   SetEnv HR_DB_PASS your_password
 *   SetEnv HR_DB_NAME your_db
 *
 * Env vars take precedence over this file.
 */

return [
    'host' => 'localhost',
    'user' => 'your_db_user',
    'pass' => 'your_password_here',
    'name' => 'your_db_name',
];
