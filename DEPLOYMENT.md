# Deployment Guide

Quick reference for setting up this project on a new machine or server.

## 🔧 Local Development Setup

```bash
# 1. Clone
git clone https://github.com/PonuoM/HR.git
cd HR

# 2. Frontend dependencies
npm install

# 3. Configure DB credentials (option A: secrets file)
cp api/.db-secrets.example.php api/.db-secrets.php
# Edit api/.db-secrets.php with real DB host/user/pass/name

# 4. Start dev server
npm run dev
```

The PHP backend runs under your local web server (e.g., AppServ/XAMPP) at
`http://localhost/hr-mobile-connect/api/`. Vite dev proxy is configured to
forward `/hr-mobile-connect/api` calls.

## 📋 Production Server Requirements

- Apache + `mod_rewrite` + `mod_env`
- **PHP 8.0 or newer** — required by `api/attendance_pdf.php` (mPDF v8)
- MySQL 5.7+ / MariaDB 10.3+ (utf8mb4)
- `api/lib/vendor/` is checked into the repo (mPDF + Sarabun fonts, ~11 MB) —
  no `composer install` step is needed on the server.

> Local AppServ ships PHP 7.3 which **cannot** run mPDF v8. The PDF endpoint
> only works on a PHP 8 server (i.e. production). All other endpoints
> remain compatible with PHP 7.3 for dev.

## 🔄 PWA Cache Busting

Bump `CACHE_NAME` in [public/sw.js](public/sw.js) (e.g. `hr-connect-vN` →
`hr-connect-vN+1`) on every release that changes shipped frontend assets.
Without a bump, returning users see the previous build until they hard-reload.

## 🚀 Production Deployment (Apache)

### Option A — Apache `SetEnv` (preferred)

In your vhost or `.htaccess`:

```apache
SetEnv HR_DB_HOST localhost
SetEnv HR_DB_USER your_db_user
SetEnv HR_DB_PASS your_password
SetEnv HR_DB_NAME your_db_name
```

⚠️ Make sure `mod_env` is enabled (`a2enmod env` on Debian).

### Option B — Secrets file on server

SSH into the server and create `api/.db-secrets.php` directly (not via git):

```bash
cat > api/.db-secrets.php <<'EOF'
<?php
return [
    'host' => 'localhost',
    'user' => 'your_db_user',
    'pass' => 'your_password',
    'name' => 'your_db_name',
];
EOF
chmod 600 api/.db-secrets.php
```

### Build + Deploy

```bash
npm run host:build           # builds frontend into host-build/
# upload host-build/ contents to web root
# upload api/ folder (without .db-secrets.php — set on server separately)
```

## 🗄️ Database Migrations

After upload, run migrations from `database/`:
```
php database/run-migrations.php
```
Or apply individual `.sql` files via phpMyAdmin / mysql CLI.

## 🩺 Smoke Test

```bash
curl https://your-domain/api/auth.php?action=validate_session
```
Should return `{"valid":true}` (or 401 if no token — both indicate the API
is alive and DB-connected).

If you see HTTP 500 with `Database credentials not configured`, neither
env vars nor `.db-secrets.php` were found.

## 🔐 Security Notes

- **Never commit** real credentials. `api/.db-secrets.php`, `MCP SQL SERVER.md`,
  and `HR.csv`/`HR_*.sql` are all in `.gitignore`.
- DB password is loaded at runtime from env or gitignored file — code in git
  contains no secrets.
- Production should use `SetEnv` over the file approach when possible
  (one less file to keep secret on disk).

## 📦 Project Layout

```
api/                    PHP backend (one file per resource)
api/.db-secrets.php     DB creds (gitignored, you create locally)
api/config.php          Dev DB config loader
api/config.production.php  Prod DB config loader
components/             Shared React components
contexts/               React contexts (Auth, etc.)
database/               SQL migrations
hooks/                  React hooks (useApi, etc.)
screens/                Top-level route screens
screens/admin/          Admin-only screens
services/               Frontend API client
utils/                  Shared utilities
```
