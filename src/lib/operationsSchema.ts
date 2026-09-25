// Leaf module: database initialization must not import operational services.
export const CUSTOMER_OPERATIONS_SCHEMA=`
CREATE TABLE IF NOT EXISTS customer_classifications(client_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,tags_json TEXT NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(client_id,revision));
CREATE TABLE IF NOT EXISTS customer_internal_notes(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS customer_notes_client ON customer_internal_notes(client_id,created_at,id);
CREATE TRIGGER IF NOT EXISTS customer_classification_no_update BEFORE UPDATE ON customer_classifications BEGIN SELECT RAISE(ABORT,'Customer history immutable'); END;
CREATE TRIGGER IF NOT EXISTS customer_classification_no_delete BEFORE DELETE ON customer_classifications BEGIN SELECT RAISE(ABORT,'Customer history retained'); END;
CREATE TRIGGER IF NOT EXISTS customer_notes_no_update BEFORE UPDATE ON customer_internal_notes BEGIN SELECT RAISE(ABORT,'Customer notes immutable'); END;
CREATE TRIGGER IF NOT EXISTS customer_notes_no_delete BEFORE DELETE ON customer_internal_notes BEGIN SELECT RAISE(ABORT,'Customer notes retained'); END;
`;
export const INCIDENT_TRIAGE_SCHEMA=`
CREATE TABLE IF NOT EXISTS incident_sla_policy(revision INTEGER PRIMARY KEY,pickup_minutes INTEGER,provider_minutes INTEGER,resolution_minutes INTEGER,reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS incident_triage(case_id TEXT NOT NULL REFERENCES visit_cases(id),revision INTEGER NOT NULL,severity TEXT NOT NULL,owner_label TEXT NOT NULL,internal_note TEXT NOT NULL,policy_revision INTEGER REFERENCES incident_sla_policy(revision),picked_up_at TEXT NOT NULL,provider_due_at TEXT,resolution_due_at TEXT,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(case_id,revision));
CREATE TRIGGER IF NOT EXISTS incident_sla_no_update BEFORE UPDATE ON incident_sla_policy BEGIN SELECT RAISE(ABORT,'SLA history immutable'); END;
CREATE TRIGGER IF NOT EXISTS incident_sla_no_delete BEFORE DELETE ON incident_sla_policy BEGIN SELECT RAISE(ABORT,'SLA history retained'); END;
CREATE TRIGGER IF NOT EXISTS incident_triage_no_update BEFORE UPDATE ON incident_triage BEGIN SELECT RAISE(ABORT,'Triage history immutable'); END;
CREATE TRIGGER IF NOT EXISTS incident_triage_no_delete BEFORE DELETE ON incident_triage BEGIN SELECT RAISE(ABORT,'Triage history retained'); END;
`;
