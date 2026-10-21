/** Additive data only. Existing jobs, prices and financial records are never migrated. */
export const NEW_FEATURES_SCHEMA=`
CREATE TABLE IF NOT EXISTS job_beneficiaries(
 job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 name TEXT NOT NULL,email TEXT NOT NULL,consent_at TEXT NOT NULL,
 token_hash TEXT UNIQUE,expires_at TEXT,accepted_by TEXT REFERENCES users(id) ON DELETE CASCADE,
 revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS provider_open_slots(
 id TEXT PRIMARY KEY,firm_id TEXT NOT NULL REFERENCES firms(id),team_id TEXT NOT NULL REFERENCES workspace_teams(id),
 city TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,category TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,
 request_key TEXT NOT NULL,approved_by TEXT,approved_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(firm_id,request_key)
);
CREATE INDEX IF NOT EXISTS provider_open_slots_search ON provider_open_slots(active,starts_at,ends_at);
CREATE TABLE IF NOT EXISTS feature_pilots(feature_key TEXT PRIMARY KEY,city TEXT NOT NULL,approved_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS job_slot_requests(
 job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,slot_id TEXT NOT NULL REFERENCES provider_open_slots(id),
 slot_revision INTEGER NOT NULL,starts_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS photo_scope_runs(
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,
 status TEXT NOT NULL,result_json TEXT,created_ms INTEGER NOT NULL,PRIMARY KEY(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS photo_scope_drafts(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,description TEXT NOT NULL,photo_ids TEXT NOT NULL,
 job_id TEXT UNIQUE REFERENCES jobs(id),expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,request_key)
);
`;
