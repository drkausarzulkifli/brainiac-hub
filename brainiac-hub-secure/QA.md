# Validation — 17 November 2026

Target: separate Hostinger PHP/MySQL implementation in this folder. The existing Sites demo and live Hostinger deployment were not changed.

## Passed

- PHP syntax: `public/api.php`, `brainiac-private/bootstrap.php`.
- JavaScript syntax: application scripts, including final `auth.js`.
- `tests/api.cjs`: empty initial state; first-admin setup lock; authenticated sessions; CSRF and origin rejection; role enforcement on server writes; full cross-role history reads; stale revision rejection; idempotent writes; JSON object preservation; temporary-password rotation; disabled-account session revocation; final-admin protection; logout; login rate limits.
- `tests/browser.cjs`: login; empty dashboard; staff and student forms; save-result dialogs; DOB from IC; persistence after reload; calendar-linked EIP notes without a study plan; shared records across separate browser contexts; conflicts retain form content; responsive mobile login; no JavaScript errors.
- `tests/clinical.cjs`: compulsory password change; Therapist/Cikgu menus; SOAP without prior assessment; assessment and progress draft saves; DOB prefill; assessment/progress PDF downloads with the deployment CSP applied; teacher reads therapy history; direct navigation to a forbidden module returns to dashboard.
- `tests/network.cjs`: server commits but response is lost; retry uses the original request identifier before newer edits; expired sessions hide the patient form and preserve its contents through reauthentication and subsequent save.
- Visual review: desktop dashboard and mobile login screenshots.
- Packaging assertions: all referenced entry-page assets exist; all 11 initial collections empty; no role selector; no localStorage data loader; no test database, test accounts or real configuration in the archive.

## Test environment and remaining deployment verification

PHP 8.5.12 portable runtime, SQLite test database derived from the supplied MySQL schema, isolated headless Edge browser contexts. Test data is fictional and excluded from the ZIP.

MySQL/MariaDB execution on Hostinger, actual host PHP settings, HTTPS/cookie behavior and Apache `.htaccess` enforcement still require deployment verification. The browser connection to the existing Hostinger tab timed out twice; no host changes were made. Follow `PANDUAN-HOSTINGER.md` for installation and live acceptance tests before real records are entered.

The application uses revision-checked shared JSON state rather than real-time per-record merging. A concurrent change requires the second editor to retain/copy their notes and refresh. This prevents silent overwrites but can cause friction with many concurrent editors.
