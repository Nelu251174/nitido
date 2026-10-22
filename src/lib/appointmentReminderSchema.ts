/** Additive operational reminders. Existing bookings and financial records remain untouched. */
export const APPOINTMENT_REMINDER_SCHEMA=`
CREATE TABLE IF NOT EXISTS appointment_reminders(
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
 scheduled_at TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('24h','2h')),channel TEXT NOT NULL CHECK(channel IN ('inapp','push','email')),device_id TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_ms INTEGER NOT NULL DEFAULT 0,
 claim_token TEXT,claimed_ms INTEGER,dispatch_ms INTEGER,provider_id TEXT,last_error TEXT,created_ms INTEGER NOT NULL,
 UNIQUE(job_id,firm_id,scheduled_at,kind,channel,device_id)
);
CREATE INDEX IF NOT EXISTS appointment_reminders_due ON appointment_reminders(status,next_ms,created_ms);
CREATE TABLE IF NOT EXISTS appointment_acknowledgments(
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,scheduled_at TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,confirmed_at TEXT NOT NULL,PRIMARY KEY(job_id,firm_id,scheduled_at)
);
`;
