import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {normalizeCity,firmCoversCity} from './text';
import {firmAvailabilityError,type JobTiming} from './firmAvailability';
import {bucharestDateKey,bucharestScheduledAt} from './scheduling';
import {calcServiceDuration,calcServicePrice,validBathroomCount,validWindowsSqm,SLOT_HOURS,BUFFER_MINUTES,type SpaceType} from './pricing';
export class AvailabilityError extends Error{constructor(message:string,public status=409){super(message)}}
type Opening={id:string;firm_id:string;team_id:string;city:string;category:string;starts_at:string;ends_at:string;revision:number;active:number;approved_at:string|null;firm_name:string;minimum_duration_minutes:number;travel_minutes:number;verified:number;suspended_until:string|null;coverage_city:string;coverage_cities_extra:string|null;team_active:number};
const openingSql=`SELECT s.*,u.name firm_name,t.minimum_duration_minutes,t.travel_minutes,t.active team_active,f.verified,f.suspended_until,f.coverage_city,f.coverage_cities_extra FROM provider_open_slots s JOIN firms f ON f.id=s.firm_id JOIN users u ON u.id=f.user_id JOIN workspace_teams t ON t.id=s.team_id AND t.firm_id=f.id`;
export function getOpening(db:Database,id:string){return db.prepare(openingSql+' WHERE s.id=?').get(id) as Opening|undefined;}
export function weekContext(value:Record<string,unknown>){
 const city=typeof value.city==='string'?value.city.trim():'';const type=value.spaceType??'apartament',sqm=Number(value.sqm??80),bathroomCount=Number(value.bathroomCount??1),windowsSqm=Number(value.windowsSqm??0);
 if(!city||city.length>100||!['apartament','casa','birou','altul'].includes(String(type))||!Number.isInteger(sqm)||sqm<10||sqm>1000||!validBathroomCount(bathroomCount)||!validWindowsSqm(windowsSqm))throw new AvailabilityError('Completează localitatea, tipul și dimensiunile valide ale spațiului.',400);
 return {city,spaceType:type as SpaceType,sqm,bathroomCount,windowsSqm,duration:calcServiceDuration(sqm,windowsSqm),price:calcServicePrice(type as SpaceType,sqm,windowsSqm,bathroomCount),category:type==='birou'?'office':'general'};
}
export function checkOpening(db:Database,s:Opening|undefined,start:string,context:ReturnType<typeof weekContext>,jobId='opening-check'){
 if(!s||!s.approved_at||!s.active||!s.team_active||!s.verified||s.suspended_until&&(!Number.isFinite(Date.parse(s.suspended_until))||Date.parse(s.suspended_until)>Date.now())||normalizeCity(s.city)!==normalizeCity(context.city)||!firmCoversCity(s.coverage_city,s.coverage_cities_extra,context.city)||s.category!==context.category)throw new AvailabilityError('Intervalul, firma sau serviciul nu mai este disponibil.');
 if(!db.prepare('SELECT 1 FROM service_catalog_firms WHERE category_key=? AND firm_id=? AND enabled=1').get(context.category,s.firm_id))throw new AvailabilityError('Serviciul nu este activ în catalogul firmei.');
 const t=Date.parse(start),end=t+(context.duration+BUFFER_MINUTES)*60000;
 if(!Number.isFinite(t)||new Date(t).toISOString()!==start||t<Date.now()+3600000||t>Date.now()+7*86400000||t<Date.parse(s.starts_at)||end>Date.parse(s.ends_at)||s.minimum_duration_minutes>context.duration||s.travel_minutes>BUFFER_MINUTES)throw new AvailabilityError('Durata lucrării și deplasarea nu încap în intervalul publicat.');
 const timing:JobTiming={id:jobId,scheduled_at:start,when_type:'scheduled',duration_minutes:context.duration,buffer_minutes:BUFFER_MINUTES};
 const error=firmAvailabilityError(db,s.firm_id,timing);if(error)throw new AvailabilityError(error);
 if(db.prepare('SELECT 1 FROM workspace_team_blocks WHERE team_id=? AND cancelled=0 AND starts_at<? AND ends_at>?').get(s.team_id,new Date(end).toISOString(),start))throw new AvailabilityError('Echipa a devenit indisponibilă. Alege alt interval.');return s;
}
export function listWeekOpenings(db:Database,value:Record<string,unknown>,acceptStart?:(start:string,end:string)=>boolean){
 const context=weekContext(value);const pilot=db.prepare("SELECT city FROM feature_pilots WHERE feature_key='weekly'").get() as {city:string}|undefined;if(!pilot||normalizeCity(pilot.city)!==normalizeCity(context.city))return {options:[],context,pilotCity:pilot?.city??null,pilotReady:false};const rows=db.prepare(openingSql+" WHERE s.active=1 AND s.approved_at IS NOT NULL AND s.ends_at>? AND s.starts_at<? ORDER BY s.starts_at,s.id LIMIT 200").all(new Date().toISOString(),new Date(Date.now()+7*86400000).toISOString()) as Opening[];
 const options:{slotId:string;revision:number;firmName:string;city:string;startsAt:string;endsAt:string;price:number;duration:number}[]=[];
 const today=new Date(bucharestDateKey(new Date())+'T12:00:00Z');
 for(const s of rows){if(normalizeCity(s.city)!==normalizeCity(context.city))continue;for(let d=0;d<7;d++){const date=new Date(today);date.setUTCDate(date.getUTCDate()+d);for(const h of SLOT_HOURS){const start=bucharestScheduledAt(date.toISOString().slice(0,10),h).toISOString();if(acceptStart&&!acceptStart(start,new Date(Date.parse(start)+(context.duration+BUFFER_MINUTES)*60000).toISOString()))continue;try{checkOpening(db,s,start,context);options.push({slotId:s.id,revision:s.revision,firmName:s.firm_name,city:s.city,startsAt:start,endsAt:new Date(Date.parse(start)+(context.duration+BUFFER_MINUTES)*60000).toISOString(),price:context.price,duration:context.duration});}catch(e){if(!(e instanceof AvailabilityError))throw e;}if(options.length>=40)return {options,context,pilotCity:pilot.city,pilotReady:true};}}}
 return {options,context,pilotCity:pilot.city,pilotReady:true};
}
export function publishOpening(db:Database,firmId:string,value:Record<string,unknown>){
 const start=String(value.startsAt??''),end=String(value.endsAt??''),city=String(value.city??'').trim(),category=String(value.category??'general'),teamId=String(value.teamId??''),key=String(value.requestKey??'');
 if(!key||key.length>100||!['general','office'].includes(category)||!city||city.length>100||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||new Date(start).toISOString()!==start||new Date(end).toISOString()!==end||Date.parse(start)<Date.now()||Date.parse(end)>Date.now()+8*86400000||Date.parse(end)-Date.parse(start)<210*60000||Date.parse(end)-Date.parse(start)>24*3600000)throw new AvailabilityError('Publică un interval viitor de minimum 3 ore și 30 minute, în următoarea săptămână.',400);
 return db.transaction(()=>{
  const existing=db.prepare('SELECT * FROM provider_open_slots WHERE firm_id=? AND request_key=?').get(firmId,key) as {id:string;team_id:string;city:string;starts_at:string;ends_at:string;category:string}|undefined;
  if(existing){if(existing.team_id!==teamId||existing.city!==city||existing.starts_at!==start||existing.ends_at!==end||existing.category!==category)throw new AvailabilityError('Identificator deja folosit pentru alt interval.');return existing.id;}
  const firm=db.prepare('SELECT verified,suspended_until,coverage_city,coverage_cities_extra FROM firms WHERE id=?').get(firmId) as Pick<Opening,'verified'|'suspended_until'|'coverage_city'|'coverage_cities_extra'>|undefined;
  if(!firm?.verified||firm.suspended_until&&(!Number.isFinite(Date.parse(firm.suspended_until))||Date.parse(firm.suspended_until)>Date.now())||!firmCoversCity(firm.coverage_city,firm.coverage_cities_extra,city)||!db.prepare('SELECT 1 FROM workspace_teams WHERE id=? AND firm_id=? AND active=1').get(teamId,firmId)||!db.prepare('SELECT 1 FROM service_catalog_firms WHERE category_key=? AND firm_id=? AND enabled=1').get(category,firmId))throw new AvailabilityError('Verifică echipa, localitatea și serviciul activ al firmei.',403);
  if(db.prepare('SELECT 1 FROM provider_open_slots WHERE team_id=? AND active=1 AND starts_at<? AND ends_at>?').get(teamId,end,start))throw new AvailabilityError('Echipa are deja un interval publicat care se suprapune.');
  const id=randomUUID();db.prepare('INSERT INTO provider_open_slots(id,firm_id,team_id,city,starts_at,ends_at,category,request_key) VALUES(?,?,?,?,?,?,?,?)').run(id,firmId,teamId,city,start,end,category,key);return id;
 }).immediate();
}
export function withdrawOpening(db:Database,firmId:string,id:string){if(!db.prepare('SELECT 1 FROM provider_open_slots WHERE id=? AND firm_id=?').get(id,firmId))throw new AvailabilityError('Interval inexistent.',404);db.prepare('UPDATE provider_open_slots SET active=0,revision=revision+1 WHERE id=? AND active=1').run(id);}
export function attachOpeningRequest(db:Database,jobId:string,ownerId:string,id:string,revision:number,start:string){
 const j=db.prepare('SELECT * FROM jobs WHERE id=? AND client_id=?').get(jobId,ownerId) as {city:string;space_type:string;sqm:number;bathroom_count:number;windows_sqm:number;scheduled_at:string;mode:string;status:string;duration_minutes:number;buffer_minutes:number}|undefined;
 if(!j||j.mode!=='standard'||j.status!=='waiting'||j.scheduled_at!==start)throw new AvailabilityError('Verifică data exactă și modul Standard înainte de a solicita intervalul.');
 const context=weekContext({city:j.city,spaceType:j.space_type,sqm:j.sqm,bathroomCount:j.bathroom_count,windowsSqm:j.windows_sqm});if(j.duration_minutes!==context.duration||j.buffer_minutes!==BUFFER_MINUTES)throw new AvailabilityError('Durata sau deplasarea cererii necesită reconfirmare.');
 const s=checkOpening(db,getOpening(db,id),start,context,jobId);
 if(s.revision!==revision)throw new AvailabilityError('Intervalul s-a schimbat. Alege din nou.');
 db.prepare('INSERT INTO job_slot_requests(job_id,slot_id,slot_revision,starts_at) VALUES(?,?,?,?)').run(jobId,id,revision,start);
}
export function openingRequest(db:Database,jobId:string){if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='job_slot_requests'").get())return undefined;return db.prepare('SELECT r.*,s.firm_id,s.team_id FROM job_slot_requests r JOIN provider_open_slots s ON s.id=r.slot_id WHERE r.job_id=?').get(jobId) as {job_id:string;slot_id:string;slot_revision:number;starts_at:string;firm_id:string;team_id:string}|undefined;}
export function validateOpeningConfirmation(db:Database,jobId:string,firmId:string){
 const r=openingRequest(db,jobId);if(!r)return null;if(r.firm_id!==firmId)throw new AvailabilityError('Cererea este adresată firmei intervalului ales.');
 const j=db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId) as {city:string;space_type:string;sqm:number;bathroom_count:number;windows_sqm:number;scheduled_at:string;duration_minutes:number;buffer_minutes:number};
 if(j.scheduled_at!==r.starts_at)throw new AvailabilityError('Programarea s-a schimbat. Alege din nou intervalul.');
 const context=weekContext({city:j.city,spaceType:j.space_type,sqm:j.sqm,bathroomCount:j.bathroom_count,windowsSqm:j.windows_sqm});if(j.duration_minutes!==context.duration||j.buffer_minutes!==BUFFER_MINUTES)throw new AvailabilityError('Durata sau deplasarea cererii s-a schimbat. Reconfirmă intervalul.');
 const s=checkOpening(db,getOpening(db,r.slot_id),r.starts_at,context,jobId);
 if(j.scheduled_at!==r.starts_at)throw new AvailabilityError('Programarea nu mai corespunde intervalului.');
 if(s.revision!==r.slot_revision)throw new AvailabilityError('Intervalul a fost retras sau schimbat. Solicită alt interval.');return r;
}

export function approveOpening(db:Database,id:string,actor:string,confirmed:boolean){
 if(confirmed!==true)throw new AvailabilityError('Confirmă verificarea disponibilității cu firma și echipa.',400);
 return db.transaction(()=>{const s=getOpening(db,id);if(!s||!s.active)throw new AvailabilityError('Interval indisponibil.',404);
 const pilot=db.prepare("SELECT city FROM feature_pilots WHERE feature_key='weekly'").get() as {city:string}|undefined;
 if(pilot&&normalizeCity(pilot.city)!==normalizeCity(s.city))throw new AvailabilityError('Pilotul este limitat la '+pilot.city+'. Extinderea necesită o validare separată.');
 const context=weekContext({city:s.city,spaceType:s.category==='office'?'birou':'apartament',sqm:80});let available=false;
 const today=new Date(bucharestDateKey(new Date())+'T12:00:00Z');
 for(let d=0;d<7&&!available;d++){const day=new Date(today);day.setUTCDate(day.getUTCDate()+d);for(const hour of SLOT_HOURS){try{checkOpening(db,{...s,approved_at:new Date().toISOString()},bucharestScheduledAt(day.toISOString().slice(0,10),hour).toISOString(),context);available=true;break;}catch(e){if(!(e instanceof AvailabilityError))throw e;}}}
 if(!available)throw new AvailabilityError('Nu există un început valid cu durată și deplasare acoperite. Verifică serviciul, calendarul și limitele echipei.');
 db.prepare("INSERT OR IGNORE INTO feature_pilots(feature_key,city,approved_by) VALUES('weekly',?,?)").run(s.city,actor);
 db.prepare('UPDATE provider_open_slots SET approved_at=COALESCE(approved_at,?),approved_by=COALESCE(approved_by,?) WHERE id=?').run(new Date().toISOString(),actor,id);return s.city;
 }).immediate();
}

export function selectedOpening(db:Database,value:Record<string,unknown>){
 const context=weekContext(value),pilot=db.prepare("SELECT city FROM feature_pilots WHERE feature_key='weekly'").get() as {city:string}|undefined;
 if(!pilot||normalizeCity(pilot.city)!==normalizeCity(context.city))throw new AvailabilityError('Nu există încă intervale verificate în această localitate.');
 const start=String(value.startsAt??''),s=checkOpening(db,getOpening(db,String(value.slotId??'')),start,context);
 if(s.revision!==Number(value.revision))throw new AvailabilityError('Intervalul s-a schimbat. Alege din nou.');
 return {slotId:s.id,revision:s.revision,startsAt:start,firmName:s.firm_name,context};
}
