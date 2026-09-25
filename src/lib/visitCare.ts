import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {auditWorkflow} from './proofOfWork';
import {executionAccess} from './collaborationAccess';
import {WorkspaceError,requireText} from './workspace';
import {CHECKLIST} from './workspaceShared';
import {bucharestScheduledAt} from './scheduling';
import {firmAvailabilityError} from './firmAvailability';
import {INCIDENT_REVIEW_SCHEMA,incidentReviews} from './incidentReview';
import {isWithinGuaranteeWindow} from './guarantee';
export const VISIT_CARE_SCHEMA=`
CREATE TABLE IF NOT EXISTS visit_instructions(job_id TEXT PRIMARY KEY REFERENCES jobs(id),rooms INTEGER,sensitive_materials TEXT NOT NULL,usual_tasks TEXT NOT NULL,preferences TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS visit_cases(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),opened_by TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,category TEXT NOT NULL,item_key TEXT,description TEXT NOT NULL,photo_id TEXT REFERENCES job_photos(id),status TEXT NOT NULL DEFAULT 'open',proposed_at TEXT,reclean_job_id TEXT REFERENCES jobs(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(opened_by,request_key));
CREATE INDEX IF NOT EXISTS visit_cases_job ON visit_cases(job_id,created_at);
CREATE TABLE IF NOT EXISTS visit_case_events(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES visit_cases(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS visit_receipts(job_id TEXT PRIMARY KEY REFERENCES jobs(id),client_id TEXT NOT NULL REFERENCES users(id),confirmed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS communication_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id),return_reminders INTEGER NOT NULL DEFAULT 0,referral_offers INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS visit_case_events_case ON visit_case_events(case_id,created_at);
CREATE TABLE IF NOT EXISTS workspace_notices(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),job_id TEXT REFERENCES jobs(id),message TEXT NOT NULL,path TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT);
CREATE INDEX IF NOT EXISTS workspace_notices_user ON workspace_notices(user_id,read_at,created_at);
${INCIDENT_REVIEW_SCHEMA}
`;
export function notice(db:Database,userId:string,jobId:string|null,message:string,path:string){db.prepare('INSERT INTO workspace_notices(id,user_id,job_id,message,path,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),userId,jobId,message,path,new Date().toISOString());}
export function snapshotInstructions(db:Database,jobId:string,propertyId:string,clientId:string){
 const p=db.prepare('SELECT rooms,sensitive_materials,usual_tasks,notes FROM workspace_properties WHERE id=? AND owner_id=? AND archived=0').get(propertyId,clientId) as {rooms:number|null;sensitive_materials:string;usual_tasks:string;notes:string}|undefined;
 if(!p)throw new WorkspaceError('Proprietate indisponibilă.',404);
 // Access codes are deliberately not copied into future visits.
 db.prepare('INSERT OR IGNORE INTO visit_instructions VALUES(?,?,?,?,?,?)').run(jobId,p.rooms,p.sensitive_materials,p.usual_tasks,p.notes,new Date().toISOString());
}
type Actor={id:string;role:string};
function access(db:Database,jobId:string,user:Actor){
 const j=db.prepare('SELECT j.*,f.user_id firm_user_id FROM jobs j LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE j.id=?').get(jobId) as {id:string;client_id:string;firm_user_id:string|null;status:string;accepted_firm_id:string|null;guarantee_of:string|null;completed_at:string|null;duration_minutes:number;buffer_minutes:number;windows_sqm?:number}|undefined;
 if(!j)throw new WorkspaceError('Lucrare inexistentă.',404);
 const owner=j.client_id===user.id,firm=j.firm_user_id===user.id,admin=user.role==='admin';
 const worker=!owner&&!firm&&!admin&&['accepted','arrived'].includes(j.status)&&!!executionAccess(db,user.id,jobId);
 if(!owner&&!firm&&!admin&&!worker)throw new WorkspaceError('Acces interzis.',403);
 return {job:j,owner,firm,admin,worker};
}
function event(db:Database,id:string,userId:string,action:string,note:string){
 const previous=db.prepare('SELECT updated_at FROM visit_cases WHERE id=?').get(id) as {updated_at:string}|undefined;
 const now=new Date(Math.max(Date.now(),previous?Date.parse(previous.updated_at)+1:0)).toISOString();db.prepare('INSERT INTO visit_case_events VALUES(?,?,?,?,?,?)').run(randomUUID(),id,userId,action,note,now);db.prepare('UPDATE visit_cases SET updated_at=? WHERE id=?').run(now,id);
 const c=db.prepare('SELECT j.id,j.client_id,f.user_id FROM visit_cases c JOIN jobs j ON j.id=c.job_id LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE c.id=?').get(id) as {id:string;client_id:string;user_id:string|null};
 for(const uid of [c.client_id,c.user_id])if(uid&&uid!==userId)notice(db,uid,c.id,'Dosarul unei lucrări a fost actualizat.',`/remedieri?jobId=${encodeURIComponent(c.id)}`);
}
export function readVisitCare(db:Database,jobId:string,user:Actor){
 const a=access(db,jobId,user);
 const cases=db.prepare('SELECT id,category,item_key,description,photo_id,status,proposed_at,reclean_job_id,created_at,updated_at FROM visit_cases WHERE job_id=? ORDER BY created_at DESC').all(jobId) as {id:string;updated_at:string}[];
 return {canConfirm:a.owner,canManage:a.firm,canResolve:a.owner||a.admin,canReport:!!a.job.accepted_firm_id,jobStatus:a.job.status,instructions:db.prepare('SELECT rooms,sensitive_materials,usual_tasks,preferences FROM visit_instructions WHERE job_id=?').get(jobId)??null,receipt:db.prepare('SELECT confirmed_at FROM visit_receipts WHERE job_id=?').get(jobId)??null,photos:db.prepare("SELECT id,proof_type FROM job_photos WHERE job_id=? AND status='VALID'").all(jobId),cases:cases.map(c=>({...c,reviews:incidentReviews(db,c.id),events:db.prepare('SELECT action,note,created_at FROM visit_case_events WHERE case_id=? ORDER BY created_at,id').all(c.id)}))};
}
export function changeVisitCare(db:Database,jobId:string,user:Actor,b:Record<string,unknown>){
 return db.transaction(()=>{
  const a=access(db,jobId,user),j=a.job;
  if(b.action==='confirm'){
   if(!a.owner||j.status!=='completed')throw new WorkspaceError('Confirmarea clientului este disponibilă după finalizarea lucrării.',409);
   if(db.prepare("SELECT 1 FROM visit_cases WHERE job_id=? AND status NOT IN ('resolved','closed')").get(jobId))throw new WorkspaceError('Soluționează dosarul deschis înainte de confirmarea lucrării.',409);
   db.prepare('INSERT OR IGNORE INTO visit_receipts VALUES(?,?,?)').run(jobId,user.id,new Date().toISOString());return {ok:true};
  }
  if(b.action==='open'){
   if(!j.accepted_firm_id)throw new WorkspaceError('Raportarea este disponibilă după alocarea firmei.',409);
   const category=requireText(b.category,'Tip problemă',40),description=requireText(b.description,'Descriere',2000),key=requireText(b.requestKey,'Cerere',100);
   if(!['access','absent','scope','damage','quality','task'].includes(category))throw new WorkspaceError('Categorie invalidă.');
   const item=b.itemKey?requireText(b.itemKey,'Sarcină',40):null;
   if(category==='task'&&!item)throw new WorkspaceError('Selectează sarcina nerealizabilă.');
   if(item&&!CHECKLIST.some(c=>c.key===item))throw new WorkspaceError('Sarcină invalidă.');
   const photo=b.photoId?requireText(b.photoId,'Fotografie',100):null;
   if(photo&&!db.prepare("SELECT 1 FROM job_photos WHERE id=? AND job_id=? AND status='VALID'").get(photo,jobId))throw new WorkspaceError('Fotografia nu aparține lucrării.',403);
   const old=db.prepare('SELECT id,job_id,description,category,item_key,photo_id FROM visit_cases WHERE opened_by=? AND request_key=?').get(user.id,key) as {id:string;job_id:string;description:string;category:string;item_key:string|null;photo_id:string|null}|undefined;
   if(old){if(old.job_id!==jobId||old.description!==description||old.category!==category||old.item_key!==item||old.photo_id!==photo)throw new WorkspaceError('Cerere deja folosită cu alte date.',409);return {ok:true,id:old.id};}
   const id=randomUUID(),now=new Date().toISOString();db.prepare('INSERT INTO visit_cases(id,job_id,opened_by,request_key,category,item_key,description,photo_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,jobId,user.id,key,category,item,description,photo,now,now);if(category==='task'&&item&&['accepted','arrived'].includes(j.status)&&!db.prepare('SELECT 1 FROM workspace_execution_reports WHERE job_id=?').get(jobId)){
    const previous=db.prepare('SELECT done FROM workspace_checklist WHERE job_id=? AND item_key=?').get(jobId,item) as {done:number}|undefined;
    if(previous?.done!==0){
     db.prepare('INSERT INTO workspace_checklist(job_id,item_key,done,updated_by,updated_at) VALUES(?,?,0,?,?) ON CONFLICT(job_id,item_key) DO UPDATE SET done=0,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(jobId,item,user.id,now);
     auditWorkflow(db,'CHECKLIST_ITEM_CHANGED',jobId,j.accepted_firm_id,user.id,{itemKey:item,previous:previous?Boolean(previous.done):null,done:false,caseId:id,reason:'task_reported_unavailable'});
    }
   }event(db,id,user.id,'open',description);return {ok:true,id};
  }
  const id=requireText(b.caseId,'Dosar',100);
  const c=db.prepare('SELECT * FROM visit_cases WHERE id=? AND job_id=?').get(id,jobId) as {status:string;updated_at:string;proposed_at:string|null;reclean_job_id:string|null;created_at:string}|undefined;
  if(!c)throw new WorkspaceError('Dosar inexistent.',404);
  if(b.revision!==c.updated_at)throw new WorkspaceError('Dosarul s-a schimbat. Reîncarcă înainte de a continua.',409);
  const note=requireText(b.note,'Răspuns / motiv',2000);
  if(b.action==='reply'){event(db,id,user.id,'reply',note);return {ok:true};}
  if(['resolved','closed'].includes(c.status))throw new WorkspaceError('Dosarul este închis.',409);
  if(b.action==='propose'||b.action==='accept'){
   const eligible=j.accepted_firm_id?db.prepare('SELECT suspended_until FROM firms WHERE id=? AND verified=1').get(j.accepted_firm_id) as {suspended_until:string|null}|undefined:undefined;
   if(!eligible||(eligible.suspended_until&&(!Number.isFinite(Date.parse(eligible.suspended_until))||Date.parse(eligible.suspended_until)>Date.now())))throw new WorkspaceError('Firma inițială nu mai este disponibilă pentru alocare.',409);
  }
  if(b.action==='propose'){
   if(!a.firm||j.status!=='completed'||j.guarantee_of||!isWithinGuaranteeWindow(j.completed_at,new Date(c.created_at)))throw new WorkspaceError('Remedierea gratuită necesită o sesizare în termenul existent de 48h și confirmarea firmei inițiale.',409);
   if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isInteger(b.hour)||![8,10,12,14,16,18].includes(Number(b.hour))||!Number.isFinite(Date.parse(`${b.date}T12:00:00Z`))||new Date(`${b.date}T12:00:00Z`).toISOString().slice(0,10)!==b.date)throw new WorkspaceError('Dată sau oră invalidă.');
   const date=bucharestScheduledAt(b.date,Number(b.hour)).toISOString();
   if(Date.parse(date)<Date.now()+3600000||Date.parse(date)>Date.now()+90*86400000)throw new WorkspaceError('Alege o dată viitoare în următoarele 90 de zile.');
   const conflict=firmAvailabilityError(db,j.accepted_firm_id!,{id:jobId,when_type:'scheduled',scheduled_at:date,duration_minutes:j.duration_minutes,buffer_minutes:j.buffer_minutes});if(conflict)throw new WorkspaceError(conflict,409);
   if(c.reclean_job_id||db.prepare('SELECT 1 FROM jobs WHERE guarantee_of=?').get(jobId))throw new WorkspaceError('Există deja o vizită de remediere.',409);
   db.prepare("UPDATE visit_cases SET status='proposed',proposed_at=? WHERE id=?").run(date,id);event(db,id,user.id,'propose',note);return {ok:true};
  }
  if(b.action==='accept'){
   if(!a.owner||j.guarantee_of||!isWithinGuaranteeWindow(j.completed_at,new Date(c.created_at))||c.status!=='proposed'||!c.proposed_at||j.status!=='completed'||Date.parse(c.proposed_at)<Date.now()+3600000)throw new WorkspaceError('Propunerea necesită actualizare sau confirmarea clientului.',409);
   if(db.prepare('SELECT 1 FROM jobs WHERE guarantee_of=?').get(jobId))throw new WorkspaceError('Există deja o remediere pentru lucrare.',409);
   const conflict=firmAvailabilityError(db,j.accepted_firm_id!,{id:jobId,when_type:'scheduled',scheduled_at:c.proposed_at,duration_minutes:j.duration_minutes,buffer_minutes:j.buffer_minutes});if(conflict)throw new WorkspaceError(conflict,409);
   const newId=`job_${randomUUID()}`;
   db.prepare(`INSERT INTO jobs(id,client_id,street,postal_code,city,floor,details,sqm,space_type,when_type,scheduled_at,price_gross,credit_applied,duration_minutes,buffer_minutes,photos_count,mode,guarantee_of,status,accepted_firm_id,accepted_at)
    SELECT ?,client_id,street,postal_code,city,floor,?,sqm,space_type,'scheduled',?,0,0,duration_minutes,buffer_minutes,0,'standard',id,'accepted',accepted_firm_id,? FROM jobs WHERE id=?`).run(newId,'Vizită de remediere. Verificați instrucțiunile și accesul cu clientul.',c.proposed_at,new Date().toISOString(),jobId);
   db.prepare('UPDATE jobs SET pricing_snapshot=? WHERE id=? AND pricing_snapshot IS NULL').run(JSON.stringify({version:'nitido-remediation-v1',currency:'RON',recordedAt:new Date().toISOString(),grossBani:0,creditBani:0,clientTotalBani:0,lines:[{code:'cleaning',amountBani:0},{code:'express60',amountBani:0},{code:'platform_credit',amountBani:0}]}),newId);
   const property=db.prepare('SELECT property_id FROM workspace_property_jobs WHERE job_id=?').get(jobId) as {property_id:string}|undefined;
   if((j.windows_sqm??0)>0)db.prepare('UPDATE jobs SET windows_sqm=? WHERE id=?').run(j.windows_sqm,newId);
   if(property)db.prepare('INSERT INTO workspace_property_jobs(job_id,property_id) VALUES(?,?)').run(newId,property.property_id);
   db.prepare("UPDATE visit_cases SET status='scheduled',reclean_job_id=? WHERE id=?").run(newId,id);event(db,id,user.id,'accept',note);return {ok:true,jobId:newId};
  }
  if(b.action==='resolve'){
   if(!a.owner&&!a.admin)throw new WorkspaceError('Soluționarea trebuie confirmată de client sau administrator.',403);
   if(c.reclean_job_id&&!(db.prepare("SELECT 1 FROM jobs WHERE id=? AND status IN ('completed','cancelled')").get(c.reclean_job_id)))throw new WorkspaceError('Vizita de remediere este încă activă.',409);
   db.prepare("UPDATE visit_cases SET status='resolved' WHERE id=?").run(id);event(db,id,user.id,'resolve',note);return {ok:true};
  }
  if(b.action==='reject'&&a.owner&&c.status==='proposed'){db.prepare("UPDATE visit_cases SET status='open',proposed_at=NULL WHERE id=?").run(id);event(db,id,user.id,'reject',note);return {ok:true};}
  throw new WorkspaceError('Acțiune nepermisă.',403);
 }).immediate();
}

export function notifySchedule(db:Database,jobId:string,message:string){
 const j=db.prepare('SELECT j.client_id,f.user_id FROM jobs j LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE j.id=?').get(jobId) as {client_id:string;user_id:string|null}|undefined;
 if(!j)return;
 notice(db,j.client_id,jobId,message,`/client?jobId=${encodeURIComponent(jobId)}`);
 if(j.user_id)notice(db,j.user_id,jobId,message,`/firma?job=${encodeURIComponent(jobId)}`);
 const members=db.prepare("SELECT DISTINCT m.user_id FROM workspace_assignments a JOIN workspace_members m ON m.kind='team' AND m.resource_id=a.team_id AND m.active=1 WHERE a.job_id=?").all(jobId) as {user_id:string}[];
 for(const m of members)notice(db,m.user_id,null,'Programul echipei a fost actualizat. Verifică lucrările tale.','/echipa');
}
