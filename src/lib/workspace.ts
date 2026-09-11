import { COLLABORATION_SCHEMA, executionAccess } from "@/lib/collaborationAccess";
import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";

export const WORKSPACE_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspace_properties (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
 city TEXT NOT NULL, street TEXT NOT NULL, sqm INTEGER NOT NULL, space_type TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'home', cost_center TEXT NOT NULL DEFAULT '', budget_bani INTEGER NOT NULL DEFAULT 0,
 notes TEXT NOT NULL DEFAULT '', budget_enforced INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workspace_properties_owner ON workspace_properties(owner_id,archived);
CREATE TABLE IF NOT EXISTS workspace_property_jobs (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id), property_id TEXT NOT NULL REFERENCES workspace_properties(id)
);
CREATE TABLE IF NOT EXISTS workspace_teams (
 id TEXT PRIMARY KEY, firm_id TEXT NOT NULL REFERENCES firms(id), name TEXT NOT NULL,
 color TEXT NOT NULL DEFAULT '#0f766e', active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS workspace_assignments (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id), team_id TEXT NOT NULL REFERENCES workspace_teams(id),
 assigned_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_checklist (
 job_id TEXT NOT NULL REFERENCES jobs(id), item_key TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0,
 updated_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL,
 PRIMARY KEY(job_id,item_key)
);
CREATE TABLE IF NOT EXISTS workspace_messages (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), sender_id TEXT NOT NULL REFERENCES users(id),
 request_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(sender_id,request_id)
);
CREATE INDEX IF NOT EXISTS workspace_messages_job ON workspace_messages(job_id,created_at);
CREATE TABLE IF NOT EXISTS workspace_calendar_events (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES workspace_properties(id), source TEXT NOT NULL,
 uid TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, summary TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active', imported_at TEXT NOT NULL,
 UNIQUE(property_id,source,uid)
);
CREATE TABLE IF NOT EXISTS workspace_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 resource_id TEXT NOT NULL, created_at TEXT NOT NULL
);
` + COLLABORATION_SCHEMA;
import { CHECKLIST } from "@/lib/workspaceShared";
export class WorkspaceError extends Error { constructor(message:string,public status=400){super(message)} }
export function requireText(value:unknown,label:string,max=250) {
 if(typeof value!=="string"||!value.trim()||value.trim().length>max)throw new WorkspaceError(`${label}: completează între 1 și ${max} caractere.`);
 return value.trim();
}
function audit(db:Database,actor:string,action:string,id:string){db.prepare("INSERT INTO workspace_audit VALUES(?,?,?,?,?)").run(randomUUID(),actor,action,id,new Date().toISOString())}
export function ownProperty(db:Database,userId:string,id:string) {
 const row=db.prepare("SELECT * FROM workspace_properties WHERE id=? AND owner_id=? AND archived=0").get(id,userId) as Property|undefined;
 if(!row)throw new WorkspaceError("Proprietate inexistentă",404);return row;
}
export interface Property {id:string;owner_id:string;name:string;city:string;street:string;sqm:number;space_type:string;kind:string;cost_center:string;budget_bani:number;notes:string;archived:number}
export function saveProperty(db:Database,userId:string,b:Record<string,unknown>) {
 const name=requireText(b.name,"Denumire",100),city=requireText(b.city,"Oraș",100),street=requireText(b.street,"Adresă");
 const sqm=Number(b.sqm),budget=Number(b.budget_bani??0);
 if(!Number.isInteger(sqm)||sqm<1||sqm>1000||!Number.isSafeInteger(budget)||budget<0||budget>100000000)throw new WorkspaceError("Suprafața sau bugetul nu este valid.");
 if(!["apartament","casa","birou","altul"].includes(String(b.space_type))||!["home","business","host"].includes(String(b.kind)))throw new WorkspaceError("Tip de proprietate invalid.");
 const notes=String(b.notes??"").trim(),center=String(b.cost_center??"").trim();
 if(notes.length>2000||center.length>100)throw new WorkspaceError("Detaliile sunt prea lungi.");
 const id=typeof b.id==="string"?b.id:randomUUID();
 return db.transaction(()=>{if(b.id){ownProperty(db,userId,id);db.prepare("UPDATE workspace_properties SET name=?,city=?,street=?,sqm=?,space_type=?,kind=?,cost_center=?,budget_bani=?,notes=? WHERE id=? AND owner_id=?").run(name,city,street,sqm,b.space_type,b.kind,center,budget,notes,id,userId)}else{db.prepare("INSERT INTO workspace_properties(id,owner_id,name,city,street,sqm,space_type,kind,cost_center,budget_bani,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(id,userId,name,city,street,sqm,b.space_type,b.kind,center,budget,notes,new Date().toISOString())}audit(db,userId,"property.save",id);return id})()
}
export function linkPropertyJob(db:Database,userId:string,propertyId:string,jobId:string){
 ownProperty(db,userId,propertyId);
 if(!db.prepare("SELECT id FROM jobs WHERE id=? AND client_id=?").get(jobId,userId))throw new WorkspaceError("Lucrare inexistentă",404);
 db.prepare("INSERT INTO workspace_property_jobs(job_id,property_id) VALUES(?,?) ON CONFLICT(job_id) DO UPDATE SET property_id=excluded.property_id").run(jobId,propertyId);
 audit(db,userId,"property.link_job",jobId);
}
export function authorizedJob(db:Database,userId:string,jobId:string){
 const job=db.prepare("SELECT j.*,f.user_id AS firm_user_id FROM jobs j LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE j.id=? AND (j.client_id=? OR f.user_id=?)").get(jobId,userId,userId) as {id:string;client_id:string;firm_user_id:string|null;status:string;accepted_firm_id:string|null}|undefined;
 if(!job)throw new WorkspaceError("Lucrare inexistentă",404);return job;
}
export function sendJobMessage(db:Database,userId:string,jobId:string,body:unknown,requestId:unknown){
 const job=authorizedJob(db,userId,jobId);
 if(!job.accepted_firm_id)throw new WorkspaceError("Mesajele sunt disponibile după alocarea firmei.");
 const text=requireText(body,"Mesaj",2000),request=requireText(requestId,"Identificator",100);
 const existing=db.prepare("SELECT id,job_id,body FROM workspace_messages WHERE sender_id=? AND request_id=?").get(userId,request) as {id:string;job_id:string;body:string}|undefined;
 if(existing){if(existing.job_id!==jobId||existing.body!==text)throw new WorkspaceError("Identificator deja folosit pentru alt mesaj.",409);return existing.id}
 const id=randomUUID();db.prepare("INSERT INTO workspace_messages VALUES(?,?,?,?,?,?)").run(id,jobId,userId,request,text,new Date().toISOString());return id;
}
export function assignTeam(db:Database,userId:string,teamId:string,jobId:string){
 return db.transaction(()=>{
 const team=db.prepare("SELECT t.* FROM workspace_teams t JOIN firms f ON f.id=t.firm_id WHERE t.id=? AND f.user_id=? AND t.active=1").get(teamId,userId) as {id:string;firm_id:string}|undefined;
 const job=authorizedJob(db,userId,jobId);
 if(!team||job.accepted_firm_id!==team.firm_id||!["accepted","arrived"].includes(job.status))throw new WorkspaceError("Echipa sau lucrarea nu poate fi alocată.",403);
 const timing=db.prepare("SELECT scheduled_at,duration_minutes,buffer_minutes FROM jobs WHERE id=?").get(jobId) as {scheduled_at:string|null;duration_minutes:number;buffer_minutes:number};
 if(!timing.scheduled_at)throw new WorkspaceError("Lucrarea trebuie să aibă o programare.");
 const start=new Date(timing.scheduled_at).getTime(),end=start+(timing.duration_minutes+timing.buffer_minutes)*60000;
 const other=db.prepare("SELECT j.scheduled_at,j.duration_minutes,j.buffer_minutes FROM workspace_assignments a JOIN jobs j ON j.id=a.job_id WHERE a.team_id=? AND a.job_id!=? AND j.status IN ('accepted','arrived')").all(teamId,jobId) as typeof timing[];
 if(other.some(j=>{const s=new Date(j.scheduled_at??"").getTime();return s<end&&s+(j.duration_minutes+j.buffer_minutes)*60000>start}))throw new WorkspaceError("Echipa are deja o lucrare în acest interval.",409);
 db.prepare("INSERT INTO workspace_assignments VALUES(?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET team_id=excluded.team_id,assigned_by=excluded.assigned_by,created_at=excluded.created_at").run(jobId,teamId,userId,new Date().toISOString());audit(db,userId,"team.assign",jobId);
 })();
}
export function setChecklist(db:Database,userId:string,jobId:string,key:string,done:boolean){
 const access=executionAccess(db,userId,jobId);
 if(!access||!["accepted","arrived"].includes(access.status))throw new WorkspaceError("Nu poți modifica verificările acestei lucrări.",403);
 if(db.prepare("SELECT 1 FROM workspace_execution_reports WHERE job_id=?").get(jobId))throw new WorkspaceError("Raportul a fost trimis. Verificările sunt blocate pentru a păstra dovada raportată.",409);
 if(!CHECKLIST.some(i=>i.key===key))throw new WorkspaceError("Verificare invalidă.");
 db.prepare("INSERT INTO workspace_checklist VALUES(?,?,?,?,?) ON CONFLICT(job_id,item_key) DO UPDATE SET done=excluded.done,updated_by=excluded.updated_by,updated_at=excluded.updated_at").run(jobId,key,done?1:0,userId,new Date().toISOString());
}

// Manual iCal import: no server-side URL fetch and no guest data copied into titles.
export function parseCalendar(input:string) {
 if(Buffer.byteLength(input)>1_000_000)throw new WorkspaceError("Fișierul depășește 1 MB.");
 if(!input.includes("BEGIN:VCALENDAR")||!input.includes("END:VCALENDAR"))throw new WorkspaceError("Fișier iCal invalid.");
 const blocks=input.replace(/\r?\n[ \t]/g,"").split("BEGIN:VEVENT").slice(1);
 if(blocks.length>1000)throw new WorkspaceError("Maximum 1.000 de evenimente per import.");
 return blocks.map(block=>{
  const lines=block.split(/\r?\n/);const get=(name:string)=>lines.find(l=>l.startsWith(`${name}:`)||l.startsWith(`${name};`));
  const val=(name:string)=>{const l=get(name);return l?.slice(l.indexOf(":")+1).trim()??""};
  function date(name:string){const raw=val(name);if(!/^\d{8}(T\d{6}Z)?$/.test(raw))throw new WorkspaceError("Calendarul trebuie să folosească date întregi sau ore UTC (Z).");const iso=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`+(raw.length===8?"T00:00:00Z":`T${raw.slice(9,11)}:${raw.slice(11,13)}:${raw.slice(13,15)}Z`);const d=new Date(iso);if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==iso.slice(0,10))throw new WorkspaceError("Dată invalidă în calendar.");return d.toISOString()}
  const uid=requireText(val("UID"),"UID",500),status=val("STATUS")==="CANCELLED"?"cancelled":"active";
  if(status==="cancelled"&&!val("DTSTART"))return {uid,status,starts_at:"",ends_at:""};
  const starts_at=date("DTSTART"),ends_at=date("DTEND");
  if(ends_at<=starts_at)throw new WorkspaceError("Interval calendaristic invalid.");
  if(val("RRULE")||val("RECURRENCE-ID"))throw new WorkspaceError("Exportă evenimente individuale; recurențele iCal nu sunt acceptate la import.");
  return {uid,status,starts_at,ends_at};
 });
}
export function importCalendar(db:Database,userId:string,propertyId:string,source:string,input:string){
 ownProperty(db,userId,propertyId);const key=requireText(source,"Sursă",80),events=parseCalendar(input),now=new Date().toISOString();
 return db.transaction(()=>{for(const e of events){if(!e.starts_at){db.prepare("UPDATE workspace_calendar_events SET status='cancelled',imported_at=? WHERE property_id=? AND source=? AND uid=?").run(now,propertyId,key,e.uid);continue}db.prepare("INSERT INTO workspace_calendar_events VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(property_id,source,uid) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,imported_at=excluded.imported_at").run(randomUUID(),propertyId,key,e.uid,e.starts_at,e.ends_at,"Perioadă ocupată",e.status,now)}audit(db,userId,"calendar.import",propertyId);return events.length})();
}
