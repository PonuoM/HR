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
