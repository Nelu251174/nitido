import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {currentIncidentPolicy,currentIncidentTriage,incidentDeadlines} from './incidentTriage';
import {WorkspaceError,requireText} from './workspace';
export const incidentSlaEnabled=()=>process.env.NITIDO_INCIDENT_SLA_ALERTS_ENABLED==='true';
type Kind='pickup'|'provider'|'resolution';
type Target={case_id:string;kind:Kind;policy_revision:number;triage_revision:number|null;due_at:string;escalation:'operations'|'management'};
type Alert=Target&{id:string;detected_at:string};
type Policy={revision:number;pickup_minutes:number|null;provider_minutes:number|null;resolution_minutes:number|null};
const minute=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=525600;
// SQLite timestamps without an offset are UTC. Reject normalized invalid calendar dates.
function instant(value:string|null|undefined):number|null{
 if(!value)return null;
 const m=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
 if(!m)return null;
 const normalized=value.replace(' ','T')+(m[8]?'':'Z'),time=Date.parse(normalized);
 if(!Number.isFinite(time))return null;
 const offset=m[8]&&m[8]!=='Z'?(m[8][0]==='-'?-1:1)*(Number(m[8].slice(1,3))*60+Number(m[8].slice(4)))*60000:0;
 const local=new Date(time+offset);
 return local.getUTCFullYear()===Number(m[1])&&local.getUTCMonth()+1===Number(m[2])&&local.getUTCDate()===Number(m[3])&&local.getUTCHours()===Number(m[4])&&local.getUTCMinutes()===Number(m[5])&&local.getUTCSeconds()===Number(m[6])?time:null;
}
function targets(db:Database,caseId:string,now:number):Target[]{
 const c=db.prepare('SELECT status,created_at FROM visit_cases WHERE id=?').get(caseId) as {status:string;created_at:string}|undefined;
 if(!c||['resolved','closed'].includes(c.status)||instant(c.created_at)===null)return [];
 const triage=currentIncidentTriage(db,caseId);
 const policy=triage?.policy_revision?db.prepare('SELECT * FROM incident_sla_policy WHERE revision=?').get(triage.policy_revision) as Policy|undefined:triage?undefined:currentIncidentPolicy(db);
 if(!policy||!Number.isSafeInteger(policy.revision)||policy.revision<1)return [];
 let deadlines:ReturnType<typeof incidentDeadlines>;
 try{deadlines=incidentDeadlines(db,caseId,now);}catch{return [];}
 const result:Target[]=[];
 for(const [kind,due,overdue,minutes] of [['pickup',deadlines.pickupDue,deadlines.pickupOverdue,policy.pickup_minutes],['provider',deadlines.providerDue,deadlines.providerOverdue,policy.provider_minutes],['resolution',deadlines.resolutionDue,deadlines.resolutionOverdue,policy.resolution_minutes]] as const){
  const dueMs=instant(due),anchor=kind==='pickup'?instant(c.created_at):instant(triage?.picked_up_at);
  if(kind==='provider'&&!db.prepare('SELECT 1 FROM visit_cases c JOIN jobs j ON j.id=c.job_id JOIN firms f ON f.id=j.accepted_firm_id WHERE c.id=?').get(caseId))continue;
  if(!overdue||!minute(minutes)||dueMs===null||anchor===null||Math.abs(dueMs-anchor-minutes*60000)>1||dueMs>=now)continue;
  result.push({case_id:caseId,kind,policy_revision:policy.revision,triage_revision:triage?.revision??null,due_at:new Date(dueMs).toISOString(),escalation:kind==='provider'?'operations':'management'});
 }
 return result;
}
const matches=(a:Target,b:Target)=>a.case_id===b.case_id&&a.kind===b.kind&&a.policy_revision===b.policy_revision&&a.due_at===b.due_at;
function audit(db:Database,action:string,target:string,details:object){
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,target,JSON.stringify(details));
}
/** A bounded cursor scan is serialized by the SQLite writer transaction, including across processes. */
export function runIncidentSla(db:Database,now=new Date()){
 if(!incidentSlaEnabled())return {enabled:false,scanned:0,created:0,cycleComplete:false};
 const time=now.getTime();if(!Number.isFinite(time))throw new WorkspaceError('Moment de verificare invalid.');
 return db.transaction(()=>{
  const cursor=(db.prepare('SELECT cursor FROM incident_sla_worker_state WHERE id=1').get() as {cursor:string}|undefined)?.cursor??'';
  const cases=db.prepare("SELECT id FROM visit_cases WHERE status NOT IN ('closed','resolved') AND id>? ORDER BY id LIMIT 251").all(cursor) as {id:string}[];
  const batch=cases.slice(0,250);let created=0;
  for(const c of batch)for(const target of targets(db,c.id,time)){
   const id=randomUUID();
   const changed=db.prepare('INSERT OR IGNORE INTO incident_sla_alerts(id,case_id,kind,policy_revision,triage_revision,due_at,detected_at,escalation) VALUES(?,?,?,?,?,?,?,?)').run(id,target.case_id,target.kind,target.policy_revision,target.triage_revision,target.due_at,now.toISOString(),target.escalation);
   if(changed.changes){audit(db,'incident.sla.alert',c.id,{actorId:'incident_sla_worker',alertId:id,...target});created++;}
  }
  const cycleComplete=cases.length<=250,next=cycleComplete?'':batch[batch.length-1].id;
  db.prepare('INSERT INTO incident_sla_worker_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor').run(next);
  return {enabled:true,scanned:batch.length,created,cycleComplete};
 }).immediate();
}
/** Current deadline, policy and provider response are rechecked; obsolete alerts remain only in immutable history. */
export function incidentSlaInbox(db:Database,caseId?:string,now=Date.now()){
 if(caseId!==undefined)requireText(caseId,'Dosar',100);
 return db.transaction(()=>{
  const rows=db.prepare(`SELECT a.* FROM incident_sla_alerts a WHERE (?='' OR a.case_id=?) AND NOT EXISTS(SELECT 1 FROM incident_sla_acknowledgements k WHERE k.alert_id=a.id) ORDER BY a.due_at,a.id LIMIT 1001`).all(caseId??'',caseId??'') as Alert[];
  if(rows.length>1000)throw new WorkspaceError(caseId?'Dosarul conține prea multe înregistrări pentru această listă. Consultă auditul administrativ.':'Inboxul conține peste 1.000 de înregistrări de verificat. Deschide un dosar pentru alertele sale.',422);
  const current=new Map<string,Target[]>();const alerts=[];
  for(const row of rows){if(!current.has(row.case_id))current.set(row.case_id,targets(db,row.case_id,now));if(!current.get(row.case_id)!.some(t=>matches(t,row)))continue;
   const c=db.prepare('SELECT job_id,updated_at FROM visit_cases WHERE id=?').get(row.case_id) as {job_id:string;updated_at:string};
   const triage=currentIncidentTriage(db,row.case_id);
   alerts.push({...row,jobId:c.job_id,caseRevision:c.updated_at,owner:triage?.owner_label??null,severity:triage?.severity??null});
  }
  return {enabled:incidentSlaEnabled(),alerts};
 })();
}
export function acknowledgeIncidentSla(db:Database,input:Record<string,unknown>,actor:string,now=Date.now(),canManage=false){
 if(!db.inTransaction||!actor)throw new WorkspaceError('Tranzacție administrativă obligatorie.',500);
 const id=requireText(input.alertId,'Alertă',100),note=requireText(input.note,'Notă de preluare',2000);
 const row=db.prepare('SELECT * FROM incident_sla_alerts WHERE id=?').get(id) as Alert|undefined;
 if(!row)throw new WorkspaceError('Alertă inexistentă.',404);
 if(row.escalation==='management'&&!canManage)throw new WorkspaceError('Escaladarea necesită preluarea managerului operațional.',403);
 const previous=db.prepare('SELECT actor_id,note FROM incident_sla_acknowledgements WHERE alert_id=?').get(id) as {actor_id:string;note:string}|undefined;
 if(previous){if(previous.actor_id!==actor||previous.note!==note)throw new WorkspaceError('Alerta a fost deja preluată.',409);return {alertId:id,acknowledged:true,replayed:true};}
 const c=db.prepare('SELECT updated_at FROM visit_cases WHERE id=?').get(row.case_id) as {updated_at:string}|undefined;
 if(!c||input.caseRevision!==c.updated_at||!targets(db,row.case_id,now).some(t=>matches(t,row)))throw new WorkspaceError('Dosarul sau termenul s-a schimbat. Reîncarcă alertele.',409);
 db.prepare('INSERT INTO incident_sla_acknowledgements VALUES(?,?,?,?)').run(id,actor,note,new Date(now).toISOString());
 audit(db,'incident.sla.acknowledge',row.case_id,{actorId:actor,alertId:id,note,kind:row.kind,policyRevision:row.policy_revision});
 return {alertId:id,acknowledged:true,replayed:false};
}
