import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {WorkspaceError, requireText} from './workspace';

// Reviews extend existing cases. They do not replace their remediation lifecycle.
export const INCIDENT_REVIEW_SCHEMA = `
CREATE TABLE IF NOT EXISTS visit_case_reviews(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES visit_cases(id),
 outcome TEXT NOT NULL CHECK(outcome IN ('confirmed','not_confirmed','needs_information')),
 note TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS visit_case_reviews_case ON visit_case_reviews(case_id,created_at);
CREATE TRIGGER IF NOT EXISTS visit_case_reviews_no_update BEFORE UPDATE ON visit_case_reviews
 BEGIN SELECT RAISE(ABORT,'Incident review history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS visit_case_reviews_no_delete BEFORE DELETE ON visit_case_reviews
 BEGIN SELECT RAISE(ABORT,'Incident review history is immutable'); END;
`;
export type IncidentReview = {outcome:string;note:string;created_at:string};
export function incidentReviews(db:Database,caseId:string):IncidentReview[]{
 return db.prepare('SELECT outcome,note,created_at FROM visit_case_reviews WHERE case_id=? ORDER BY created_at DESC,id DESC').all(caseId) as IncidentReview[];
}
export function reviewIncident(db:Database,input:Record<string,unknown>,actorId:string){
 if(!db.inTransaction)throw new Error('Incident review requires an audited transaction');
 const caseId=requireText(input.caseId,'Dosar',100),outcome=requireText(input.outcome,'Concluzie',40),note=requireText(input.note,'Motivul verificării',2000);
 if(!actorId)throw new WorkspaceError('Administrator neidentificat.',403);
 if(!['confirmed','not_confirmed','needs_information'].includes(outcome))throw new WorkspaceError('Concluzie invalidă.');
 const c=db.prepare('SELECT updated_at FROM visit_cases WHERE id=?').get(caseId) as {updated_at:string}|undefined;
 if(!c)throw new WorkspaceError('Dosar inexistent.',404);
 if(input.revision!==c.updated_at)throw new WorkspaceError('Dosarul s-a schimbat. Reîncarcă înainte de verificare.',409);
 const now=new Date(Math.max(Date.now(),Date.parse(c.updated_at)+1)).toISOString();
 const id=randomUUID();
 db.prepare('INSERT INTO visit_case_reviews VALUES(?,?,?,?,?,?)').run(id,caseId,outcome,note,actorId,now);
 db.prepare('UPDATE visit_cases SET updated_at=? WHERE id=?').run(now,caseId);
 return {id,caseId,outcome,revision:now};
}
