# Owner notifications

New client and cleaning company accounts create an administrator event in the same SQLite transaction as the account. Duplicate/rejected signups do not create events. All connection countries are included; unknown countries remain unknown. IP addresses are not copied into the outbox. The displayed country is an approximate connection location, not nationality or company domicile. Existing Romanian company onboarding requirements remain in force.

Super administrators view the latest 100 events at `/admin#inscrieri`, with individual read state. Other administrator roles cannot read this feed. Email acceptance by Resend is shown separately from inbox delivery; a provider-accepted message is not proof of inbox receipt.

Runtime configuration (never expose values in browser code or logs):

- `NITIDO_OWNER_NOTIFICATION_EMAIL=office@atpspedition.es`
- `NITIDO_OWNER_NOTIFICATIONS_ENABLED=true`
- Existing `RESEND_API_KEY` and `RESEND_FROM`.
- A new independent random `NITIDO_OWNER_ALERTS_CRON_SECRET` of at least 32 characters. Do not enable generic financial cron settings.

Run `node scripts/owner-notifications-runner.mjs` every minute inside the application container. An immediate post-response attempt also follows each committed signup. Each run claims at most five events; leases avoid concurrent delivery. Transient failures retry up to five attempts within 23 hours, using a stable Resend idempotency key. Changed payload/recipient after an uncertain attempt or expired idempotency window requires investigation; automatic resending stops to avoid duplicates. Deleted accounts suppress unsent registration messages. This is not a retroactive import of existing users.

Run `node scripts/owner-notifications-runner.mjs --test` once after activation. Its fixed idempotent event is explicitly synthetic, never a fake registration. Confirm provider acceptance and then the owner's actual inbox separately.

## Official downloads

The daily report covers the previous seven UTC dates, per country and per store. The overlapping window includes late store reports. Missing access and unpublished dates are explicitly blocked/pending, never invented zeros. Reports do not identify individuals and do not use first launches as a substitute for downloads.

Apple Sales & Trends access requires server-side `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY` (PEM), and the verified `APPLE_VENDOR_NUMBER`. The key must be authorized to read Sales & Trends for application `6810752486` / bundle `ro.nitido.app`. Initial app units and redownloads are separate; updates and in-app purchases are excluded. App units are Apple's reporting metric, not a count of distinct people.

Google requires server-side `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` with read access to the Play Statistics reports bucket, and `GOOGLE_PLAY_REPORTS_BUCKET` (`pubsite_prod_rev_…`, as shown in Play Console Download reports). The collector reads `stats/installs/installs_ro.nitido.app_YYYYMM_country.csv`; confirm this export exists in the configured bucket. It preserves `Daily Device Installs` or `Install events` as distinct metrics. Android Publisher API access alone does not grant report-bucket access. Never send private keys through chat or public CI logs.

After credentials and report exports are verified, set `NITIDO_OWNER_DOWNLOAD_REPORTS_ENABLED=true` and schedule `node scripts/store-download-report-runner.mjs` once daily (for example `0 10 * * *` UTC, 13:00 Romania summer / 12:00 winter). Run timeout should allow up to 10 minutes for store delays. Import and email digest are idempotent by UTC date. Re-running improves saved source data but does not send a duplicate digest. The following day's digest contains the corrected overlapping window. Ready source data is not downgraded by a temporary store failure.

An administrator sees missing access even before the first successful report. Do not describe reports as active until the scheduled collector and real source access have been verified. Store credentials are absent from the production environment at initial implementation.

## Validation and release

Run the owner events, reports, admin/cron route tests, existing signup/database tests, `node scripts/store-download-reports.test.mjs`, TypeScript and the normal Next build. The schema only adds three owner/report tables and their index; it does not alter jobs, payments or currencies. Before production, take and verify a SQLite online backup and apply the additive schema to an isolated restored copy. Verify sandbox authorization and health before deploying the exact candidate. Enable owner email only in production unless a separate sandbox email test is explicitly intended.
