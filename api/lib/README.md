# api/lib — vendored PHP libraries

Currently contains: **mPDF v8.3** + Sarabun TTF fonts.

Used by: [attendance_pdf.php](../attendance_pdf.php) to generate per-employee PDF reports.

## Size

`vendor/` is ~9.4 MB. Includes:
- `mpdf/mpdf/` — the mPDF library
- `mpdf/mpdf/ttfonts/`:
  - `DejaVuSansCondensed*.ttf` — Latin fallback (kept by default)
  - `Sarabun-Regular.ttf` / `Sarabun-Bold.ttf` — Thai font with traditional loops

## Local development

PHP 7.3 on AppServ cannot run mPDF v8 (needs PHP 8.0+). Test on production
or run a PHP 8 dev server.

To re-install/update vendors locally:

```bash
cd api/lib
composer install --no-dev --ignore-platform-reqs
# Re-strip unused fonts:
cd vendor/mpdf/mpdf/ttfonts
find . -maxdepth 1 -type f ! -name "DejaVuSansCondensed*" ! -name "Sarabun*" -delete
```

## Deployment

Upload the **entire `api/lib/` folder** to production via FTP/SFTP.
Production target: `/path/to/HR/api/lib/`

After deploy, verify by fetching:
```
https://hr.prima49.com/api/attendance_pdf.php?employee_id=<ID>&date_from=2026-05-01&date_to=2026-05-31
```
(headers `X-Employee-Id: <admin-id>` are required).

Expected: PDF file download starts.
