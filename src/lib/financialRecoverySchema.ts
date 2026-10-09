export const FINANCIAL_RECOVERY_SCHEMA=`
CREATE TABLE IF NOT EXISTS financial_recovery_lock (
 id INTEGER PRIMARY KEY CHECK(id=1), token TEXT, lease_until_ms INTEGER NOT NULL DEFAULT 0, next_run_ms INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS financial_recovery_runs (
 id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('running','completed','failed','abandoned')),
 started_ms INTEGER NOT NULL, completed_ms INTEGER, attempted INTEGER NOT NULL DEFAULT 0,
 processed INTEGER NOT NULL DEFAULT 0, deferred INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE TABLE IF NOT EXISTS financial_recovery_items (
 kind TEXT NOT NULL CHECK(kind IN ('event','cancellation')), resource_id TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_ms INTEGER NOT NULL DEFAULT 0,
 parked INTEGER NOT NULL DEFAULT 0 CHECK(parked IN (0,1)), last_error TEXT,
 PRIMARY KEY(kind,resource_id)
);
CREATE INDEX IF NOT EXISTS idx_financial_recovery_runs_started ON financial_recovery_runs(started_ms);
`;
