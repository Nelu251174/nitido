import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {WorkspaceError,ownProperty,requireText,parseCalendar,importCalendar} from './workspace';
import {calendarUrl,sealCalendarUrl,openCalendarUrl,downloadCalendar} from './icalTransport';

type Connection={id:string;property_id:string;owner_id:string;name:string;hostname:string;secret:string;enabled:number;full_export:number;version:number;last_attempt:string|null;last_success:string|null;next_run:string;error:string;warning:string;failures:number;event_count:number;lease_token:string|null;lease_until:string|null};
const after=(ms:number)=>new Date(Date.now()+ms).toISOString();
function property(db:Database,userId:string,id:string){const p=ownProperty(db,userId,id);if(p.kind!=='host')throw new WorkspaceError('Alege o proprietate pentru curățenie între rezervări.');return p;}
function audit(db:Database,userId:string,action:string,id:string){db.prepare('INSERT INTO workspace_audit VALUES(?,?,?,?,?)').run(randomUUID(),userId,action,id,after(0));}
export function connectionStatus(db:Database,userId:string,propertyId:string){
 property(db,userId,propertyId);
 // Explicit allowlist: never serialize the URL, cipher, token, or feed contents.
 return db.prepare("SELECT id,name,hostname,enabled,full_export,version,last_attempt,last_success,next_run,error,warning,event_count,(secret<>'') AS connected FROM workspace_ical_connections WHERE property_id=? AND owner_id=?").get(propertyId,userId)??null;
}
export function manualCalendarSources(db:Database,userId:string,propertyId:string){
 property(db,userId,propertyId);
 return db.prepare("SELECT DISTINCT source FROM workspace_calendar_events WHERE property_id=? AND source<>'Manual NITIDO' AND source NOT LIKE 'iCal:%' ORDER BY source").all(propertyId) as {source:string}[];
}
export function saveConnection(db:Database,userId:string,propertyId:string,b:Record<string,unknown>){
 property(db,userId,propertyId);
 const url=calendarUrl(requireText(b.url,'Link iCal',4096)),name=requireText(b.name,'Numele calendarului',60);
 if(b.authorized!==true)throw new WorkspaceError('Confirmă că poți conecta acest calendar.');
 return db.transaction(()=>{
  property(db,userId,propertyId);
  const old=db.prepare('SELECT * FROM workspace_ical_connections WHERE property_id=? AND owner_id=?').get(propertyId,userId) as Connection|undefined;
  if(old&&b.version!==old.version)throw new WorkspaceError('Conexiunea s-a schimbat. Reîncarcă pagina.',409);
  const id=old?.id??randomUUID(),secret=sealCalendarUrl(url.toString(),id);
  db.prepare(`INSERT INTO workspace_ical_connections(id,property_id,owner_id,name,hostname,secret,enabled,full_export,next_run,created_at)
   VALUES(?,?,?,?,?,?,1,?,?,?) ON CONFLICT(property_id) DO UPDATE SET name=excluded.name,hostname=excluded.hostname,secret=excluded.secret,
   enabled=1,full_export=excluded.full_export,version=version+1,next_run=excluded.next_run,error='',warning='',failures=0,lease_token=NULL,lease_until=NULL`)
   .run(id,propertyId,userId,name,url.hostname,secret,b.fullExport===true?1:0,after(0),after(0));
  if(!old&&b.importSource){
   const source=requireText(b.importSource,'Calendar importat',80);
   if(!manualCalendarSources(db,userId,propertyId).some(s=>s.source===source))throw new WorkspaceError('Calendarul importat nu mai este disponibil. Reîncarcă pagina.',409);
   db.prepare('UPDATE workspace_calendar_events SET source=? WHERE property_id=? AND source=?').run(`iCal:${id}`,propertyId,source);
  }
  db.prepare('DELETE FROM workspace_ical_missing WHERE connection_id=?').run(id);
  audit(db,userId,'ical.connect',id);return id;
 }).immediate();
}
export function controlConnection(db:Database,userId:string,propertyId:string,b:Record<string,unknown>){
 return db.transaction(()=>{
  property(db,userId,propertyId);const c=db.prepare('SELECT * FROM workspace_ical_connections WHERE property_id=? AND owner_id=?').get(propertyId,userId) as Connection|undefined;
  if(!c)throw new WorkspaceError('Calendar neconectat.',404);
  if(c.version!==b.version)throw new WorkspaceError('Conexiunea s-a schimbat. Reîncarcă pagina.',409);
  if(b.action==='pause'||b.action==='resume'){
   if(!c.secret)throw new WorkspaceError('Introdu din nou linkul calendarului.');
   db.prepare('UPDATE workspace_ical_connections SET enabled=?,version=version+1,next_run=?,lease_token=NULL,lease_until=NULL WHERE id=?').run(b.action==='resume'?1:0,after(0),c.id);
  }else if(b.action==='disconnect'){
   db.prepare("UPDATE workspace_ical_connections SET enabled=0,secret='',version=version+1,lease_token=NULL,lease_until=NULL,error='',warning='Calendar deconectat. Perioadele importate sunt păstrate.' WHERE id=?").run(c.id);
  }else throw new WorkspaceError('Acțiune invalidă.');
  db.prepare('DELETE FROM workspace_ical_missing WHERE connection_id=?').run(c.id);audit(db,userId,`ical.${b.action}`,c.id);
 }).immediate();
}
export async function syncConnection(db:Database,id:string,manualOwner?:string){
 const token=randomUUID(),now=after(0);
 const c=db.transaction(()=>{
  const row=db.prepare(`SELECT c.* FROM workspace_ical_connections c JOIN workspace_properties p ON p.id=c.property_id
   JOIN users u ON u.id=c.owner_id WHERE c.id=? AND p.owner_id=c.owner_id AND p.archived=0 AND p.kind='host' AND u.role='client'`).get(id) as Connection|undefined;
  if(!row||(manualOwner&&row.owner_id!==manualOwner))throw new WorkspaceError('Calendar inexistent.',404);
  if(!row.enabled)throw new WorkspaceError('Reia sincronizarea calendarului înainte de actualizare.',409);
  if(row.lease_until&&row.lease_until>now)throw new WorkspaceError('Sincronizare în curs. Revino în câteva secunde.',409);
  if(manualOwner&&row.last_attempt&&Date.parse(row.last_attempt)>Date.now()-60000)throw new WorkspaceError('Poți actualiza calendarul o dată pe minut.',429);
  if(!manualOwner&&row.next_run>now)return null;
  db.prepare('UPDATE workspace_ical_connections SET lease_token=?,lease_until=?,last_attempt=? WHERE id=?').run(token,after(60000),now,id);return row;
 }).immediate();
 if(!c)return;
 try{
  const input=await downloadCalendar(openCalendarUrl(c.secret,c.id));const events=parseCalendar(input);
  db.transaction(()=>{
   const current=db.prepare('SELECT * FROM workspace_ical_connections WHERE id=? AND version=? AND lease_token=? AND enabled=1').get(id,c.version,token) as Connection|undefined;
   if(!current)return;property(db,c.owner_id,c.property_id);
   importCalendar(db,c.owner_id,c.property_id,`iCal:${id}`,input,true);
   let pending=0,cancelled=0;
   const present=new Set(events.map(e=>e.uid));
   const active=events.filter(e=>e.status==='active');
   // Export horizons vary. Only infer absence within the successful export's represented date range.
   const from=active.map(e=>e.starts_at).sort()[0],to=active.map(e=>e.starts_at).sort().at(-1);
   const old=db.prepare("SELECT id,uid,starts_at FROM workspace_calendar_events WHERE property_id=? AND source=? AND status='active'").all(c.property_id,`iCal:${id}`) as {id:string;uid:string;starts_at:string}[];
   for(const e of old){
    if(present.has(e.uid)||!c.full_export||!from||!to||e.starts_at<now||e.starts_at.slice(0,10)<from.slice(0,10)||e.starts_at.slice(0,10)>to.slice(0,10)){db.prepare('DELETE FROM workspace_ical_missing WHERE connection_id=? AND event_id=?').run(id,e.id);continue;}
    db.prepare('INSERT INTO workspace_ical_missing VALUES(?,?,1) ON CONFLICT(connection_id,event_id) DO UPDATE SET misses=misses+1').run(id,e.id);
    const m=db.prepare('SELECT misses FROM workspace_ical_missing WHERE connection_id=? AND event_id=?').get(id,e.id) as {misses:number};
    if(m.misses>=2){db.prepare("UPDATE workspace_calendar_events SET status='cancelled',imported_at=? WHERE id=?").run(now,e.id);cancelled++;}else pending++;
   }
   const warning=!active.length?'Exportul nu conține perioade ocupate. Perioadele lipsă sunt păstrate; verifică sursa calendarului.':pending?`${pending} perioade lipsesc din export; așteptăm încă o sincronizare reușită.`:cancelled?`${cancelled} perioade au dispărut din export. Verifică lucrările de curățenie asociate.`:'';
   db.prepare("UPDATE workspace_ical_connections SET last_success=?,next_run=?,error='',warning=?,failures=0,event_count=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").run(after(0),after(15*60000),warning,events.length,id,token);
   audit(db,c.owner_id,'ical.sync.success',id);
  }).immediate();
 }catch(e){
  const message=e instanceof WorkspaceError?e.message:'Calendarul nu a putut fi descărcat. Verifică linkul de export; vom reîncerca automat.';
  db.transaction(()=>{
   const updated=db.prepare('UPDATE workspace_ical_connections SET error=?,failures=failures+1,next_run=?,lease_token=NULL,lease_until=NULL WHERE id=? AND version=? AND lease_token=?').run(message,after(Math.min(6*3600000,15*60000*2**Math.min(c.failures,5))),id,c.version,token);
   if(updated.changes){db.prepare('DELETE FROM workspace_ical_missing WHERE connection_id=?').run(id);audit(db,c.owner_id,'ical.sync.failed',id);}
  }).immediate();
  if(manualOwner)throw new WorkspaceError(message,502);
 }
}

declare global{var __nitidoIcalTimer:ReturnType<typeof setInterval>|undefined;var __nitidoIcalRunning:boolean|undefined;}
export function startIcalScheduler(db:Database){
 if(global.__nitidoIcalTimer||process.env.NEXT_PHASE==='phase-production-build')return;
 const tick=async()=>{
  if(global.__nitidoIcalRunning)return;global.__nitidoIcalRunning=true;
  try{
   const due=db.prepare(`SELECT c.id FROM workspace_ical_connections c JOIN workspace_properties p ON p.id=c.property_id JOIN users u ON u.id=c.owner_id
    WHERE c.enabled=1 AND c.next_run<=? AND (c.lease_until IS NULL OR c.lease_until<=?) AND p.owner_id=c.owner_id AND p.archived=0 AND p.kind='host' AND u.role='client'
    ORDER BY c.next_run LIMIT 20`).all(after(0),after(0)) as {id:string}[];
   for(const c of due){try{await syncConnection(db,c.id);}catch{/* No secret URL or provider error is logged. */}}
  }catch{console.error('[ical] scheduler_failed');}finally{global.__nitidoIcalRunning=false;}
 };
 global.__nitidoIcalTimer=setInterval(()=>void tick(),60000);global.__nitidoIcalTimer.unref();
 console.info('[ical] scheduler_started interval=60s sync=15m');
}
