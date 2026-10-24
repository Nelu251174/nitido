// Dependency-free DDL: safe to load before collaboration and workspace helpers.
export const COLLABORATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspace_members (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('team','property')),
 resource_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('worker','manager','viewer')),
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 UNIQUE(kind,resource_id,user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user ON workspace_members(user_id,active);
CREATE TABLE IF NOT EXISTS workspace_invites (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
 resource_id TEXT NOT NULL, role TEXT NOT NULL, email TEXT NOT NULL,
 invited_by TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL,
 accepted_by TEXT REFERENCES users(id), revoked INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workspace_invites_resource ON workspace_invites(kind,resource_id,revoked);
CREATE TABLE IF NOT EXISTS workspace_execution_reports (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id), submitted_by TEXT NOT NULL REFERENCES users(id),
 note TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_execution_evidence (
 job_id TEXT PRIMARY KEY REFERENCES workspace_execution_reports(job_id), snapshot_json TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS execution_evidence_no_update BEFORE UPDATE ON workspace_execution_evidence
 BEGIN SELECT RAISE(ABORT,'Execution evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS execution_evidence_no_delete BEFORE DELETE ON workspace_execution_evidence
 BEGIN SELECT RAISE(ABORT,'Execution evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS execution_report_no_update BEFORE UPDATE ON workspace_execution_reports
 WHEN EXISTS(SELECT 1 FROM workspace_execution_evidence WHERE job_id=OLD.job_id)
 BEGIN SELECT RAISE(ABORT,'Submitted execution report is immutable'); END;
CREATE TRIGGER IF NOT EXISTS execution_report_no_delete BEFORE DELETE ON workspace_execution_reports
 WHEN EXISTS(SELECT 1 FROM workspace_execution_evidence WHERE job_id=OLD.job_id)
 BEGIN SELECT RAISE(ABORT,'Submitted execution report is immutable'); END;
CREATE TABLE IF NOT EXISTS workspace_approvals (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES workspace_properties(id),
 requested_by TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL,
 date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', sqm INTEGER NOT NULL,
 space_type TEXT NOT NULL, snapshot_street TEXT NOT NULL, snapshot_city TEXT NOT NULL, price_bani INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','fulfilled')),
 decided_by TEXT REFERENCES users(id), decision_note TEXT, decided_at TEXT,
 job_id TEXT UNIQUE REFERENCES jobs(id), created_at TEXT NOT NULL,
 organization_id TEXT REFERENCES workspace_organizations(id), policy_revision INTEGER, approval_mode TEXT NOT NULL DEFAULT 'manual',
 UNIQUE(requested_by,request_key)
);
CREATE INDEX IF NOT EXISTS workspace_approvals_property ON workspace_approvals(property_id,status);
`;
