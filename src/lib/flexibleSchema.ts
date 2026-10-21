export const FLEXIBLE_SCHEMA=`
CREATE TABLE IF NOT EXISTS job_flexible_preferences(job_id TEXT PRIMARY KEY REFERENCES jobs(id),windows_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS flexible_offer_details(offer_id TEXT PRIMARY KEY REFERENCES offers(id),proposal_id TEXT NOT NULL UNIQUE,team_id TEXT NOT NULL REFERENCES workspace_teams(id),starts_at TEXT NOT NULL,price_gross INTEGER NOT NULL,duration_minutes INTEGER NOT NULL,buffer_minutes INTEGER NOT NULL,preference_revision INTEGER NOT NULL,expires_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending');
`;
