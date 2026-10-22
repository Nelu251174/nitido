export const SEASON_CARE_SCHEMA=`CREATE TABLE IF NOT EXISTS home_maintenance_plans(
 id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,property_id TEXT NOT NULL REFERENCES workspace_properties(id) ON DELETE CASCADE,
 year INTEGER NOT NULL,month INTEGER NOT NULL,windows_sqm INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,
 request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(client_id,request_key));
 CREATE UNIQUE INDEX IF NOT EXISTS home_maintenance_one_month ON home_maintenance_plans(client_id,property_id,year,month) WHERE active=1;
 CREATE INDEX IF NOT EXISTS home_maintenance_plans_owner ON home_maintenance_plans(client_id,active,year,month);`;
