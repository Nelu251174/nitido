import type { Database } from 'better-sqlite3';

// Leaf schema: no dependency on assessment/planning services or the singleton DB.
export const ASSESSMENT_QUALIFICATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS assessment_qualification_events(
 assessment_id TEXT NOT NULL REFERENCES service_assessments(id),revision INTEGER NOT NULL CHECK(revision>=0),
 assessment_version INTEGER NOT NULL,criteria_version INTEGER NOT NULL DEFAULT 1 CHECK(criteria_version=1),
 outcome TEXT NOT NULL CHECK(outcome IN ('pending','ready','unavailable')),
 snapshot_json TEXT NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(assessment_id,revision)
);
CREATE TRIGGER IF NOT EXISTS assessment_qualification_no_update BEFORE UPDATE ON assessment_qualification_events
 BEGIN SELECT RAISE(ABORT,'Qualification history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS assessment_qualification_no_delete BEFORE DELETE ON assessment_qualification_events
 BEGIN SELECT RAISE(ABORT,'Qualification history is retained'); END;
`;

/** New requests only; replay never manufactures a retrospective initial observation. */
export function startAssessmentQualification(db: Database, id: string, clientId: string, createdAt: string) {
  if (!db.inTransaction) throw new Error('Qualification creation requires the assessment transaction');
  db.prepare("INSERT INTO assessment_qualification_events VALUES(?,0,1,1,'pending',?,?,?,?)").run(
    id, JSON.stringify({ source: 'request.created', assessmentVersion: 1 }),
    'Cerere nouă; pregătirea pentru un plan trebuie verificată separat.', clientId, createdAt,
  );
}
