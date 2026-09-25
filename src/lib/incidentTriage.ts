import type {Database} from 'better-sqlite3';
import {WorkspaceError,requireText} from './workspace';
export {INCIDENT_TRIAGE_SCHEMA} from './operationsSchema';
type Policy={revision:number;pickup_minutes:number|null;provider_minutes:number|null;resolution_minutes:number|null;reason:string;actor_id:string;created_at:string};
type Triage={case_id:string;revision:number;severity:string;owner_label:string;internal_note:string;policy_revision:number|null;picked_up_at:string;provider_due_at:string|null;resolution_due_at:string|null;actor_id:string;created_at:string};
export const currentIncidentPolicy=(db:Database)=>db.prepare('SELECT * FROM incident_sla_policy ORDER BY revision DESC LIMIT 1').get() as Policy|undefined;
export const currentIncidentTriage=(db:Database,id:string)=>db.prepare('SELECT * FROM incident_triage WHERE case_id=? ORDER BY revision DESC LIMIT 1').get(id) as Triage|undefined;
function transaction(db:Database,actor:string){if(!db.inTransaction||!actor)throw new WorkspaceError('Tranzacție administrativă obligatorie.',500);}
function minutes(v:unknown){if(v===null)return null;if(!Number.isInteger(v)||Number(v)<1||Number(v)>525600)throw new WorkspaceError('Termenele trebuie să fie minute întregi între 1 și 525600 sau neconfigurate.');return Number(v);}
export function saveIncidentPolicy(db:Database,input:Record<string,unknown>,actor:string){
 transaction(db,actor);const previous=currentIncidentPolicy(db);if(input.revision!==(previous?.revision??0))throw new WorkspaceError('Regula a fost modificată. Reîncarcă.',409);
 const revision=(previous?.revision??0)+1,reason=requireText(input.reason,'Motiv',2000);
 db.prepare('INSERT INTO incident_sla_policy VALUES(?,?,?,?,?,?,?)').run(revision,minutes(input.pickupMinutes),minutes(input.providerMinutes),minutes(input.resolutionMinutes),reason,actor,new Date().toISOString());
 return currentIncidentPolicy(db)!;
}
export function saveIncidentTriage(db:Database,input:Record<string,unknown>,actor:string,now=new Date().toISOString()){
 transaction(db,actor);const id=requireText(input.caseId,'Dosar',100);
 const c=db.prepare('SELECT updated_at FROM visit_cases WHERE id=?').get(id) as {updated_at:string}|undefined;
 if(!c)throw new WorkspaceError('Dosar inexistent.',404);
 if(c.updated_at!==input.caseRevision)throw new WorkspaceError('Dosarul a fost modificat. Reîncarcă.',409);
 const previous=currentIncidentTriage(db,id);if(input.revision!==(previous?.revision??0))throw new WorkspaceError('Responsabilitatea a fost modificată. Reîncarcă.',409);
 const severity=requireText(input.severity,'Severitate',20);if(!['low','normal','high','critical'].includes(severity))throw new WorkspaceError('Severitate invalidă.');
 const owner=requireText(input.owner,'Responsabil intern',150),note=requireText(input.note,'Notă internă',2000);
 const policy=currentIncidentPolicy(db),revision=(previous?.revision??0)+1;
 // Reassignment and policy edits never reset existing deadlines silently.
 const picked=previous?.picked_up_at??now;
 const due=(m:number|null|undefined)=>m==null?null:new Date(Date.parse(picked)+m*60000).toISOString();
 const providerDue=previous?previous.provider_due_at:due(policy?.provider_minutes),resolutionDue=previous?previous.resolution_due_at:due(policy?.resolution_minutes);
 db.prepare('INSERT INTO incident_triage VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,revision,severity,owner,note,previous?previous.policy_revision:policy?.revision??null,picked,providerDue,resolutionDue,actor,now);
 const caseRevision=new Date(Math.max(Date.parse(now),Date.parse(c.updated_at)+1)).toISOString();
 db.prepare('UPDATE visit_cases SET updated_at=? WHERE id=?').run(caseRevision,id);
 return {...currentIncidentTriage(db,id)!,caseRevision};
}
export function incidentDeadlines(db:Database,id:string,now=Date.now()){
 const c=db.prepare('SELECT status,created_at FROM visit_cases WHERE id=?').get(id) as {status:string;created_at:string}|undefined;
 if(!c)throw new WorkspaceError('Dosar inexistent.',404);
 const triage=currentIncidentTriage(db,id),policy=triage?.policy_revision?db.prepare('SELECT * FROM incident_sla_policy WHERE revision=?').get(triage.policy_revision) as Policy:triage?undefined:currentIncidentPolicy(db);
 // SQLite timestamps without offsets are UTC, independent of the host timezone.
 const created=db.prepare('SELECT julianday(created_at) t FROM visit_cases WHERE id=?').get(id) as {t:number|null};
 const createdMs=created.t===null?null:(created.t-2440587.5)*86400000;
 const pickupDue=createdMs!==null&&policy?.pickup_minutes!=null?new Date(Math.round(createdMs)+policy.pickup_minutes*60000).toISOString():null;
 const closed=['resolved','closed'].includes(c.status),late=(date:string|null|undefined)=>!closed&&!!date&&Date.parse(date)<now;
 const responded=!!db.prepare("SELECT 1 FROM visit_case_events e JOIN users u ON u.id=e.actor_id JOIN firms f ON f.user_id=u.id JOIN jobs j ON j.id=? WHERE e.case_id=? AND f.id=j.accepted_firm_id AND julianday(e.created_at)>=julianday(?) LIMIT 1").get((db.prepare('SELECT job_id FROM visit_cases WHERE id=?').get(id) as {job_id:string}).job_id,id,triage?.picked_up_at??new Date(now).toISOString());
 return {triage:triage??null,pickupDue,providerDue:triage?.provider_due_at??null,resolutionDue:triage?.resolution_due_at??null,pickupOverdue:!triage&&late(pickupDue),providerOverdue:!!triage&&!responded&&late(triage.provider_due_at),resolutionOverdue:!!triage&&late(triage.resolution_due_at),providerResponded:responded};
}
