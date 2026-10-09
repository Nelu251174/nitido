// Leaf schema: initialization must not load operational services.
export const INCIDENT_SLA_ALERT_SCHEMA=`
CREATE TABLE IF NOT EXISTS incident_sla_alerts (
 id TEXT PRIMARY KEY,
 case_id TEXT NOT NULL REFERENCES visit_cases(id),
 kind TEXT NOT NULL CHECK(kind IN ('pickup','provider','resolution')),
 policy_revision INTEGER NOT NULL REFERENCES incident_sla_policy(revision),
 triage_revision INTEGER,
 due_at TEXT NOT NULL,
 detected_at TEXT NOT NULL,
 escalation TEXT NOT NULL CHECK(escalation IN ('operations','management')),
 FOREIGN KEY(case_id,triage_revision) REFERENCES incident_triage(case_id,revision),
 UNIQUE(case_id,kind,policy_revision,due_at)
);
CREATE INDEX IF NOT EXISTS incident_sla_alert_case ON incident_sla_alerts(case_id,detected_at,id);
CREATE TABLE IF NOT EXISTS incident_sla_acknowledgements (
 alert_id TEXT PRIMARY KEY REFERENCES incident_sla_alerts(id),
 actor_id TEXT NOT NULL,
 note TEXT NOT NULL,
 acknowledged_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incident_sla_worker_state (id INTEGER PRIMARY KEY CHECK(id=1),cursor TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS incident_sla_alert_no_update BEFORE UPDATE ON incident_sla_alerts BEGIN SELECT RAISE(ABORT,'SLA alert immutable'); END;
CREATE TRIGGER IF NOT EXISTS incident_sla_alert_no_delete BEFORE DELETE ON incident_sla_alerts BEGIN SELECT RAISE(ABORT,'SLA alert retained'); END;
CREATE TRIGGER IF NOT EXISTS incident_sla_ack_no_update BEFORE UPDATE ON incident_sla_acknowledgements BEGIN SELECT RAISE(ABORT,'SLA acknowledgement immutable'); END;
CREATE TRIGGER IF NOT EXISTS incident_sla_ack_no_delete BEFORE DELETE ON incident_sla_acknowledgements BEGIN SELECT RAISE(ABORT,'SLA acknowledgement retained'); END;
`;
