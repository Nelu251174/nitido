export const ADMIN_OWNER_SCHEMA=`
CREATE TABLE IF NOT EXISTS admin_owner_events (
 id TEXT PRIMARY KEY,event_key TEXT NOT NULL UNIQUE,
 event_type TEXT NOT NULL CHECK(event_type IN ('CLIENT_REGISTERED','FIRM_REGISTERED','DAILY_DOWNLOAD_REPORT','SYSTEM_TEST')),
 user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 payload_json TEXT NOT NULL DEFAULT '{}',created_ms INTEGER NOT NULL,
 email_status TEXT NOT NULL DEFAULT 'pending' CHECK(email_status IN ('pending','sending','sent','failed','uncertain','suppressed')),
 attempt_count INTEGER NOT NULL DEFAULT 0,next_attempt_ms INTEGER NOT NULL DEFAULT 0,
 claim_token TEXT,claim_ms INTEGER,first_dispatch_ms INTEGER,
 provider_message_id TEXT,last_error TEXT,sent_ms INTEGER,mail_fingerprint TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_owner_pending ON admin_owner_events(email_status,next_attempt_ms,created_ms);
CREATE TABLE IF NOT EXISTS admin_owner_reads (
 event_id TEXT NOT NULL REFERENCES admin_owner_events(id) ON DELETE CASCADE,
 admin_id TEXT NOT NULL,read_ms INTEGER NOT NULL,PRIMARY KEY(event_id,admin_id)
);
CREATE TABLE IF NOT EXISTS admin_notification_reads (
 admin_id TEXT NOT NULL,event_key TEXT NOT NULL,revision TEXT NOT NULL,read_ms INTEGER NOT NULL,PRIMARY KEY(admin_id,event_key)
);
CREATE TABLE IF NOT EXISTS admin_store_daily_reports (
 source TEXT NOT NULL CHECK(source IN ('apple','google')),report_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('ready','pending','blocked')),
 metric TEXT NOT NULL CHECK(metric IN ('app_units','device_installs','install_events')),
 countries_json TEXT NOT NULL DEFAULT '[]',reason TEXT,fetched_ms INTEGER NOT NULL,
 PRIMARY KEY(source,report_date)
);`;
