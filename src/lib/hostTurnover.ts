import type {Database} from 'better-sqlite3';
import {createHash,randomUUID} from 'node:crypto';
import {ownProperty,requireText,WorkspaceError} from './workspace';
import {HOST_DEFAULTS,hostLocalInstant,type HostSettings} from './hostScheduleShared';
import {bucharestDateKey,bucharestScheduledAt,hasSchedulingLeadTime} from './scheduling';
import {BUFFER_MINUTES,SLOT_HOURS,calcDurationMinutes} from './pricing';
import type {JobRow} from './types';

type Stay={id:string;property_id:string;source:string;starts_at:string;ends_at:string;status:string;imported_at:string};
export type HostWindow={eventId:string;arrival:string;departure:string;nextArrival:string|null;earliest:string;deadline:string;revision:string;duration:number;buffer:number;slot:{date:string;hour:number}|null;jobId:string|null;jobStatus:string|null;problem:string|null;source:string;cancelled:boolean};
function propertyFor(db:Database,userId:string,propertyId:string){const p=ownProperty(db,userId,propertyId);if(p.kind!=='host')throw new WorkspaceError('Selectează o proprietate pentru curățenie între rezervări.');return p;}
const audit=(db:Database,user:string,action:string,id:string)=>db.prepare('INSERT INTO workspace_audit VALUES(?,?,?,?,?)').run(randomUUID(),user,action,id,new Date().toISOString());
export function hostSettings(db:Database,propertyId:string):HostSettings{return (db.prepare('SELECT arrival_hour,departure_hour,after_minutes,before_minutes FROM workspace_host_settings WHERE property_id=?').get(propertyId)??{...HOST_DEFAULTS}) as HostSettings;}
export function saveHostSettings(db:Database,userId:string,propertyId:string,input:Record<string,unknown>){
 const settings={} as HostSettings;
 for(const key of Object.keys(HOST_DEFAULTS) as (keyof HostSettings)[]){const n=input[key];if(typeof n!=='number'||!Number.isInteger(n)||n<0||n>(key.endsWith('hour')?23:240))throw new WorkspaceError('Orele trebuie să fie între 0 și 23, iar marjele între 0 și 240 minute.');settings[key]=n;}
 return db.transaction(()=>{
  propertyFor(db,userId,propertyId);
  db.prepare('INSERT INTO workspace_host_settings VALUES(?,?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET arrival_hour=excluded.arrival_hour,departure_hour=excluded.departure_hour,after_minutes=excluded.after_minutes,before_minutes=excluded.before_minutes').run(propertyId,settings.arrival_hour,settings.departure_hour,settings.after_minutes,settings.before_minutes);
  const events=db.prepare('SELECT m.* FROM workspace_host_event_dates m JOIN workspace_calendar_events e ON e.id=m.event_id WHERE e.property_id=?').all(propertyId) as {event_id:string;arrival_date:string;departure_date:string}[];
  for(const e of events){let start:string,end:string;try{start=hostLocalInstant(e.arrival_date,settings.arrival_hour);end=hostLocalInstant(e.departure_date,settings.departure_hour);}catch(err){throw new WorkspaceError(err instanceof Error?err.message:'Dată invalidă.');}if(end<=start)throw new WorkspaceError('Orele alese produc un interval invalid în calendar.');db.prepare('UPDATE workspace_calendar_events SET starts_at=?,ends_at=? WHERE id=?').run(start,end,e.event_id);}
  audit(db,userId,'host.settings',propertyId);
 }).immediate();
}
export function saveHostStay(db:Database,userId:string,propertyId:string,input:Record<string,unknown>){
 return db.transaction(()=>{
  propertyFor(db,userId,propertyId);
  const id=requireText(input.id,'Identificator',100);
  const existing=db.prepare('SELECT * FROM workspace_calendar_events WHERE id=?').get(id) as Stay|undefined;
  if(existing&&(existing.property_id!==propertyId||existing.source!=='Manual NITIDO'))throw new WorkspaceError('Perioada nu poate fi modificată aici.',403);
  if(input.cancel===true){
   if(!existing)throw new WorkspaceError('Perioadă inexistentă.',404);
   if(existing.status==='cancelled')return;
   if(input.version!==existing.imported_at)throw new WorkspaceError('Perioada a fost modificată. Actualizează calendarul.',409);
   db.prepare("UPDATE workspace_calendar_events SET status='cancelled',imported_at=? WHERE id=?").run(new Date().toISOString(),id);audit(db,userId,'host.stay.cancel',id);return;
  }
  if(typeof input.arrivalHour!=='number'||typeof input.departureHour!=='number')throw new WorkspaceError('Alege orele de sosire și plecare.');
  let start:string,end:string;try{start=hostLocalInstant(String(input.arrivalDate),input.arrivalHour);end=hostLocalInstant(String(input.departureDate),input.departureHour);}catch(err){throw new WorkspaceError(err instanceof Error?err.message:'Dată invalidă.');}
  if(existing&&input.version!==existing.imported_at){
   if(existing.status==='active'&&existing.starts_at===start&&existing.ends_at===end)return;
   throw new WorkspaceError('Perioada a fost modificată. Actualizează calendarul înainte de salvare.',409);
  }
  if(end<=start||Date.parse(end)-Date.parse(start)>366*86400000)throw new WorkspaceError('Plecare după sosire; maximum 366 zile per perioadă.');
  if(db.prepare("SELECT 1 FROM workspace_calendar_events WHERE property_id=? AND id!=? AND status='active' AND starts_at<? AND ends_at>?").get(propertyId,id,end,start))throw new WorkspaceError('Perioada se suprapune cu o rezervare existentă.',409);
  db.prepare("INSERT INTO workspace_calendar_events VALUES(?,?, 'Manual NITIDO',?,?,?,'Perioadă ocupată','active',?) ON CONFLICT(id) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='active',imported_at=excluded.imported_at").run(id,propertyId,id,start,end,new Date().toISOString());
  audit(db,userId,'host.stay.save',id);
 }).immediate();
}
function context(db:Database,userId:string,propertyId:string){
 const property=propertyFor(db,userId,propertyId),settings=hostSettings(db,propertyId);
 const events=db.prepare('SELECT * FROM workspace_calendar_events WHERE property_id=? ORDER BY starts_at,id').all(propertyId) as Stay[];
 const jobs=db.prepare('SELECT j.*,h.event_id FROM workspace_property_jobs p JOIN jobs j ON j.id=p.job_id LEFT JOIN workspace_host_jobs h ON h.job_id=j.id WHERE p.property_id=? AND j.client_id=?').all(propertyId,userId) as (JobRow&{event_id:string|null})[];
 return {property,settings,events,jobs};
}
function windowFor(ctx:ReturnType<typeof context>,eventId:string,now=new Date()):HostWindow{
 const {property,settings,events,jobs}=ctx,e=events.find(e=>e.id===eventId);if(!e)throw new WorkspaceError('Perioadă inexistentă.',404);
 const active=events.filter(x=>x.status==='active'),next=active.filter(x=>x.id!==e.id&&x.starts_at>=e.ends_at).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))[0];
 const earliest=new Date(Date.parse(e.ends_at)+settings.after_minutes*60000).toISOString();
 const deadline=new Date(Math.min(Date.parse(e.ends_at)+24*3600000,next?Date.parse(next.starts_at)-settings.before_minutes*60000:Infinity)).toISOString();
 const linked=jobs.filter(j=>j.event_id===e.id&&!['cancelled','no_show'].includes(j.status))[0];
 const duration=calcDurationMinutes(property.sqm),buffer=BUFFER_MINUTES;
 const revision=createHash('sha256').update(JSON.stringify({property,settings,event:e,next:next??null})).digest('hex');
 let problem=e.status==='cancelled'?'Perioada a fost anulată. Curățenia existentă trebuie soluționată separat.':active.some(x=>x.id!==e.id&&x.starts_at<e.ends_at&&x.ends_at>e.starts_at)?'Perioadele ocupate se suprapun. Corectează calendarul.':null;
 const fits=(date:string,minutes=duration,margin=buffer,except?:string)=>{
  const end=new Date(Date.parse(date)+(minutes+margin)*60000).toISOString();
  return date>=earliest&&end<=deadline&&!active.some(x=>x.id!==e.id&&x.starts_at<end&&x.ends_at>date)&&!jobs.some(j=>j.id!==except&&!['cancelled','no_show'].includes(j.status)&&j.scheduled_at&&j.scheduled_at<end&&new Date(Date.parse(j.scheduled_at)+(j.duration_minutes+j.buffer_minutes)*60000).toISOString()>date);
 };
 let slot:HostWindow['slot']=null;
 if(linked&&!problem&&(!linked.scheduled_at||!fits(linked.scheduled_at,linked.duration_minutes,linked.buffer_minutes,linked.id)))problem='Calendarul sau marjele s-au schimbat: curățenia existentă nu mai încape în interval. Reprogramează sau anulează din Rezervări.';
 if(!linked&&!problem){
  const day=new Date(`${bucharestDateKey(new Date(earliest))}T12:00:00Z`);
  for(let i=0;i<3&&!slot;i++){const date=new Date(day);date.setUTCDate(date.getUTCDate()+i);const key=date.toISOString().slice(0,10);for(const hour of SLOT_HOURS){const instant=bucharestScheduledAt(key,hour);if(hasSchedulingLeadTime(instant,now)&&fits(instant.toISOString())){slot={date:key,hour};break;}}}
  if(!slot)problem='Nu există un interval disponibil care să încapă integral, cu durata estimată și marja de lucru. Verifică orele sau rezervările existente.';
 }
 return {eventId:e.id,arrival:e.starts_at,departure:e.ends_at,nextArrival:next?.starts_at??null,earliest,deadline,revision,duration,buffer,slot,jobId:linked?.id??null,jobStatus:linked?.status??null,problem,source:e.source,cancelled:e.status==='cancelled'};
}
export function hostPlan(db:Database,userId:string,propertyId:string){
 const ctx=context(db,userId,propertyId),now=new Date();
 const windows=ctx.events.filter(e=>(Date.parse(e.ends_at)>=now.getTime()-7*86400000&&Date.parse(e.ends_at)<=now.getTime()+30*86400000)||ctx.jobs.some(j=>j.event_id===e.id&&['waiting','accepted','arrived'].includes(j.status))).slice(0,200).map(e=>windowFor(ctx,e.id,now));
 return {settings:ctx.settings,windows,events:ctx.events.slice(-1000),property:ctx.property};
}
export function turnoverReplay(db:Database,userId:string,eventId:string){
 return db.prepare("SELECT j.* FROM workspace_host_jobs h JOIN jobs j ON j.id=h.job_id JOIN workspace_calendar_events e ON e.id=h.event_id JOIN workspace_properties p ON p.id=e.property_id WHERE h.event_id=? AND p.owner_id=? AND j.client_id=? AND j.status NOT IN ('cancelled','no_show') ORDER BY h.created_at DESC LIMIT 1").get(eventId,userId,userId) as JobRow|undefined;
}
export function validateTurnoverBooking(db:Database,userId:string,body:Record<string,unknown>,date:string,duration:number,buffer:number){
 const eventId=requireText(body.hostEventId,'Perioadă',100),propertyId=requireText(body.propertyId,'Proprietate',100),ctx=context(db,userId,propertyId),w=windowFor(ctx,eventId);
 if(w.revision!==body.hostRevision)throw new WorkspaceError('Calendarul sau proprietatea s-a modificat. Revino la Curățenie între rezervări și alege propunerea actualizată.',409);
 if(w.problem)throw new WorkspaceError(w.problem,409);
 if(w.jobId)throw new WorkspaceError('Există deja o curățenie pentru această plecare.',409);
 const p=ctx.property;
 if(body.whenType!=='scheduled'||body.express60===true||body.street!==p.street||body.city!==p.city||body.sqm!==p.sqm||body.spaceType!==p.space_type||(body.postalCode??'')!==(p.postal_code??'')||(body.floor??'')!==(p.floor??''))throw new WorkspaceError('Păstrează proprietatea și programarea din propunerea de curățenie.',409);
 validateWindowDate(ctx,w,date,duration,buffer);
 return {eventId,revision:w.revision};
}
function validateWindowDate(ctx:ReturnType<typeof context>,w:HostWindow,date:string,duration:number,buffer:number,except?:string){
 const end=new Date(Date.parse(date)+(duration+buffer)*60000).toISOString();
 if(date<w.earliest||end>w.deadline||ctx.events.some(e=>e.id!==w.eventId&&e.status==='active'&&e.starts_at<end&&e.ends_at>date)||ctx.jobs.some(j=>j.id!==except&&!['cancelled','no_show'].includes(j.status)&&j.scheduled_at&&j.scheduled_at<end&&new Date(Date.parse(j.scheduled_at)+(j.duration_minutes+j.buffer_minutes)*60000).toISOString()>date))throw new WorkspaceError('Curățenia nu încape în intervalul liber sau se suprapune cu altă lucrare.',409);
}
export function validateHostReschedule(db:Database,job:JobRow,date:string){
 const row=db.prepare('SELECT e.id,e.property_id FROM workspace_host_jobs h JOIN workspace_calendar_events e ON e.id=h.event_id WHERE h.job_id=?').get(job.id) as {id:string;property_id:string}|undefined;
 if(!row)return;
 const ctx=context(db,job.client_id,row.property_id),w=windowFor(ctx,row.id);
 if(w.cancelled||ctx.events.some(e=>e.id!==w.eventId&&e.status==='active'&&e.starts_at<w.departure&&e.ends_at>w.arrival))throw new WorkspaceError('Rezolvă anularea sau suprapunerea din calendar înainte de reprogramare.',409);
 validateWindowDate(ctx,w,date,job.duration_minutes,job.buffer_minutes,job.id);
}
