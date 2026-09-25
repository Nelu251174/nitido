// Leaf module: database initialization must not import operational services.
export const CUSTOMER_RESTRICTIONS_SCHEMA=`
CREATE TABLE IF NOT EXISTS customer_restrictions(client_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL CHECK(revision>0),block_bookings INTEGER NOT NULL CHECK(block_bookings IN (0,1)),block_assessments INTEGER NOT NULL CHECK(block_assessments IN (0,1)),reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(client_id,revision));
CREATE TRIGGER IF NOT EXISTS customer_restrictions_no_update BEFORE UPDATE ON customer_restrictions BEGIN SELECT RAISE(ABORT,'Customer restriction history immutable'); END;
CREATE TRIGGER IF NOT EXISTS customer_restrictions_no_delete BEFORE DELETE ON customer_restrictions BEGIN SELECT RAISE(ABORT,'Customer restriction history retained'); END;
`;
export const CUSTOMER_OPERATIONS_SCHEMA=`
${CUSTOMER_RESTRICTIONS_SCHEMA}
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

export const EXECUTION_TEMPLATES_SCHEMA=`
CREATE TABLE IF NOT EXISTS execution_photo_templates(scope TEXT NOT NULL,revision INTEGER NOT NULL,arrival_min INTEGER NOT NULL CHECK(arrival_min BETWEEN 1 AND 20),completion_min INTEGER NOT NULL CHECK(completion_min BETWEEN 1 AND 20),PRIMARY KEY(scope,revision),FOREIGN KEY(scope,revision) REFERENCES execution_templates(scope,revision));
CREATE TABLE IF NOT EXISTS job_photo_rules(job_id TEXT PRIMARY KEY REFERENCES jobs(id),arrival_min INTEGER NOT NULL CHECK(arrival_min BETWEEN 1 AND 20),completion_min INTEGER NOT NULL CHECK(completion_min BETWEEN 1 AND 20));
CREATE TRIGGER IF NOT EXISTS execution_photo_templates_no_update BEFORE UPDATE ON execution_photo_templates BEGIN SELECT RAISE(ABORT,'Photo policy immutable'); END;
CREATE TRIGGER IF NOT EXISTS execution_photo_templates_no_delete BEFORE DELETE ON execution_photo_templates BEGIN SELECT RAISE(ABORT,'Photo policy retained'); END;
CREATE TRIGGER IF NOT EXISTS job_photo_rules_no_update BEFORE UPDATE ON job_photo_rules BEGIN SELECT RAISE(ABORT,'Photo snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS job_photo_rules_no_delete BEFORE DELETE ON job_photo_rules BEGIN SELECT RAISE(ABORT,'Photo snapshot retained'); END;
CREATE TABLE IF NOT EXISTS execution_templates(scope TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),items_json TEXT NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(scope,revision));
CREATE TABLE IF NOT EXISTS job_execution_rules(job_id TEXT PRIMARY KEY REFERENCES jobs(id),scope TEXT NOT NULL,revision INTEGER NOT NULL,items_json TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS execution_templates_no_update BEFORE UPDATE ON execution_templates BEGIN SELECT RAISE(ABORT,'Execution template immutable'); END;
CREATE TRIGGER IF NOT EXISTS execution_templates_no_delete BEFORE DELETE ON execution_templates BEGIN SELECT RAISE(ABORT,'Execution template retained'); END;
CREATE TRIGGER IF NOT EXISTS job_execution_rules_no_update BEFORE UPDATE ON job_execution_rules BEGIN SELECT RAISE(ABORT,'Execution rules immutable'); END;
CREATE TRIGGER IF NOT EXISTS job_execution_rules_no_delete BEFORE DELETE ON job_execution_rules BEGIN SELECT RAISE(ABORT,'Execution rules retained'); END;
`;

export const INCIDENT_RESOLUTION_SCHEMA=`
CREATE TABLE IF NOT EXISTS incident_resolutions(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES visit_cases(id),kind TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','completed')),note TEXT NOT NULL,reference TEXT,actor_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS incident_resolutions_case ON incident_resolutions(case_id,created_at,id);
CREATE TRIGGER IF NOT EXISTS incident_resolutions_no_update BEFORE UPDATE ON incident_resolutions BEGIN SELECT RAISE(ABORT,'Resolution history immutable'); END;
CREATE TRIGGER IF NOT EXISTS incident_resolutions_no_delete BEFORE DELETE ON incident_resolutions BEGIN SELECT RAISE(ABORT,'Resolution history retained'); END;
`;
