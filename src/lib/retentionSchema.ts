/** Additive only: no rewriting jobs, recurring preferences or payment records. */
export const RETENTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS client_favorite_firms (
 client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(client_id,firm_id)
);
CREATE TABLE IF NOT EXISTS job_preferred_requests (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 firm_id TEXT NOT NULL REFERENCES firms(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS job_repeat_origins (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 original_job_id TEXT NOT NULL REFERENCES jobs(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export const RETENTION_METRICS_SCHEMA=`
CREATE TABLE IF NOT EXISTS retention_events(
 id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('repeat_open','alert_open')),
 resource_id TEXT NOT NULL,day_key TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(client_id,kind,resource_id,day_key)
);
CREATE TABLE IF NOT EXISTS job_availability_origins(job_id TEXT PRIMARY KEY REFERENCES jobs(id),batch_id TEXT REFERENCES availability_alert_batches(id) ON DELETE SET NULL);
`;

