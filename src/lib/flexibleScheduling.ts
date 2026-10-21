import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {firmCoversCity,normalizeCity} from './text';
import {firmAvailabilityError} from './firmAvailability';
import {notice} from './visitCare';
import {bucharestScheduledAt} from './scheduling';
import {SLOT_HOURS} from './pricing';
import {validateFlexibleWindows,withinFlexibleWindows,type FlexibleWindow} from './flexibleShared';
export class FlexibleError extends Error{constructor(message:string,public status=409){super(message)}}
export type FlexiblePreference={job_id:string;windows_json:string;revision:number;active:number};
export type FlexibleProposal={offer_id:string;proposal_id:string;team_id:string;starts_at:string;price_gross:number;duration_minutes:number;buffer_minutes:number;preference_revision:number;expires_at:string;status:string};
export function flexiblePreference(db:Database,jobId:string){if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='job_flexible_preferences'").get())return undefined;return db.prepare('SELECT * FROM job_flexible_preferences WHERE job_id=? AND active=1').get(jobId) as FlexiblePreference|undefined;}
/** The pilot requires an explicitly configured zone; an SEO page is not capacity. */
export function flexiblePilotCity(){return (process.env.NITIDO_FLEX_PILOT_CITY??'').trim();}
export function requireFlexiblePilot(city:string){if(!flexiblePilotCity()||normalizeCity(city)!==normalizeCity(flexiblePilotCity()))throw new FlexibleError('Programarea flexibilă nu este încă activă în această localitate. Poți alege programarea obișnuită.');}
export function saveFlexiblePreferences(db:Database,jobId:string,clientId:string,value:unknown){
 const windows=validateFlexibleWindows(value);
 return db.transaction(()=>{const job=db.prepare('SELECT client_id,city,status,mode FROM jobs WHERE id=?').get(jobId) as {client_id:string;city:string;status:string;mode:string}|undefined;
 if(!job||job.client_id!==clientId)throw new FlexibleError('Lucrare inexistentă.',404);if(job.status!=='waiting'||job.mode!=='standard')throw new FlexibleError('Preferințele pot fi schimbate numai înaintea acceptării, în Standard.');requireFlexiblePilot(job.city);
 if(db.prepare("SELECT 1 FROM payments WHERE job_id=? AND status IN ('authorized','captured')").get(jobId))throw new FlexibleError('Există o autorizare pentru această cerere. Contactează asistența înainte de schimbare.');
 const previous=flexiblePreference(db,jobId);if(previous&&previous.windows_json===JSON.stringify(windows))return windows;
 db.prepare("INSERT INTO job_flexible_preferences(job_id,windows_json) VALUES(?,?) ON CONFLICT(job_id) DO UPDATE SET windows_json=excluded.windows_json,revision=revision+1,active=1").run(jobId,JSON.stringify(windows));
 db.prepare("UPDATE offers SET status='withdrawn' WHERE job_id=? AND status='pending'").run(jobId);return windows;
 }).immediate();
}
export function clearFlexiblePreferences(db:Database,jobId:string,clientId:string){db.transaction(()=>{const job=db.prepare('SELECT status FROM jobs WHERE id=? AND client_id=?').get(jobId,clientId) as {status:string}|undefined;if(!job)throw new FlexibleError('Lucrare inexistentă.',404);if(job.status!=='waiting')throw new FlexibleError('Programarea confirmată nu se schimbă aici.');if(!flexiblePreference(db,jobId))return;db.prepare('UPDATE job_flexible_preferences SET active=0,revision=revision+1 WHERE job_id=?').run(jobId);db.prepare("UPDATE offers SET status='withdrawn' WHERE job_id=? AND status='pending'").run(jobId);}).immediate();}
export function checkFlexibleTeam(db:Database,jobId:string,firmId:string,teamId:string,start:string){
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId) as {id:string;city:string;space_type:string;sqm:number;duration_minutes:number;buffer_minutes:number;price_gross:number}|undefined;
 const firm=db.prepare('SELECT * FROM firms WHERE id=?').get(firmId) as {verified:number;suspended_until:string|null;coverage_city:string;coverage_cities_extra:string|null}|undefined;
 const team=db.prepare('SELECT minimum_duration_minutes,travel_minutes FROM workspace_teams WHERE id=? AND firm_id=? AND active=1').get(teamId,firmId) as {minimum_duration_minutes:number;travel_minutes:number}|undefined;
 if(!job||!firm||!team||!firm.verified||firm.suspended_until&&(!Number.isFinite(Date.parse(firm.suspended_until))||Date.parse(firm.suspended_until)>Date.now())||!firmCoversCity(firm.coverage_city,firm.coverage_cities_extra,job.city))throw new FlexibleError('Firma, echipa sau zona nu este eligibilă.');
 const category=job.space_type==='birou'?'office':'general';
 if(!db.prepare('SELECT 1 FROM service_catalog_firms WHERE category_key=? AND firm_id=? AND enabled=1').get(category,firmId))throw new FlexibleError('Serviciul nu este confirmat în catalogul firmei.');
 if(team.minimum_duration_minutes>job.duration_minutes||team.travel_minutes>job.buffer_minutes)throw new FlexibleError('Durata sau deplasarea echipei depășește condițiile cererii. Este necesară o rezervare cu interval adecvat.');
 const timing={id:jobId,when_type:'scheduled',scheduled_at:start,duration_minutes:Math.max(job.duration_minutes,team.minimum_duration_minutes),buffer_minutes:Math.max(job.buffer_minutes,team.travel_minutes)};
 if(!Number.isFinite(Date.parse(start))||Date.parse(start)<Date.now()+3600000)throw new FlexibleError('Ora propusă nu mai este disponibilă.');
 const unavailable=firmAvailabilityError(db,firmId,timing);if(unavailable)throw new FlexibleError(unavailable);
 const end=new Date(Date.parse(start)+(timing.duration_minutes+timing.buffer_minutes)*60000).toISOString();
 if(db.prepare('SELECT 1 FROM workspace_team_blocks WHERE team_id=? AND cancelled=0 AND starts_at<? AND ends_at>?').get(teamId,end,start))throw new FlexibleError('Echipa este indisponibilă în acest interval, inclusiv durata și deplasarea.');
 return {...timing,price_gross:job.price_gross};
}
export function prepareFlexibleProposal(db:Database,jobId:string,firmId:string,teamId:string,start:string){
 const pref=flexiblePreference(db,jobId);if(!pref)throw new FlexibleError('Cererea nu mai folosește programarea flexibilă.');
 const job=db.prepare('SELECT city,status FROM jobs WHERE id=?').get(jobId) as {city:string;status:string};requireFlexiblePilot(job.city);if(job.status!=='waiting')throw new FlexibleError('Cererea nu mai este disponibilă.');
 if(!withinFlexibleWindows(JSON.parse(pref.windows_json),start))throw new FlexibleError('Ora propusă este în afara intervalelor acceptate de client.');
 return {pref,timing:checkFlexibleTeam(db,jobId,firmId,teamId,start)};
}
export function storeFlexibleProposal(db:Database,offerId:string,jobId:string,firmId:string,teamId:string,start:string){
 const {pref,timing}=prepareFlexibleProposal(db,jobId,firmId,teamId,start);
 const old=db.prepare('SELECT * FROM flexible_offer_details WHERE offer_id=?').get(offerId) as FlexibleProposal|undefined;
 if(old&&old.team_id===teamId&&old.starts_at===start&&old.preference_revision===pref.revision&&old.price_gross===timing.price_gross&&old.status==='pending'&&Date.parse(old.expires_at)>Date.now())return old.proposal_id;
 const id=randomUUID(),expires=new Date(Math.min(Date.now()+30*60000,Date.parse(start)-3600000)).toISOString();
 db.prepare("INSERT INTO flexible_offer_details VALUES(?,?,?,?,?,?,?,?,?,'pending') ON CONFLICT(offer_id) DO UPDATE SET proposal_id=excluded.proposal_id,team_id=excluded.team_id,starts_at=excluded.starts_at,price_gross=excluded.price_gross,duration_minutes=excluded.duration_minutes,buffer_minutes=excluded.buffer_minutes,preference_revision=excluded.preference_revision,expires_at=excluded.expires_at,status='pending'").run(offerId,id,teamId,start,timing.price_gross,timing.duration_minutes,timing.buffer_minutes,pref.revision,expires);
 const job=db.prepare('SELECT client_id FROM jobs WHERE id=?').get(jobId) as {client_id:string};notice(db,job.client_id,jobId,'Ai primit o propunere de programare. Verifică firma, ora, prețul și expirarea înainte de confirmare.',`/client?jobId=${encodeURIComponent(jobId)}`);return id;
}
export function validateFlexibleConfirmation(db:Database,jobId:string,firmId:string,offerId:string,proposalId?:string){
 const pref=flexiblePreference(db,jobId);if(!pref)return null;
 const p=db.prepare("SELECT * FROM flexible_offer_details WHERE offer_id=? AND status='pending'").get(offerId) as FlexibleProposal|undefined;
 if(!p||p.proposal_id!==proposalId||p.preference_revision!==pref.revision||Date.parse(p.expires_at)<=Date.now())throw new FlexibleError('Propunerea a expirat sau a fost schimbată. Cere o propunere nouă.');
 const {timing}=prepareFlexibleProposal(db,jobId,firmId,p.team_id,p.starts_at);
 if(timing.price_gross!==p.price_gross||timing.duration_minutes!==p.duration_minutes||timing.buffer_minutes!==p.buffer_minutes)throw new FlexibleError('Prețul, durata sau condițiile echipei s-au schimbat. Este necesară o propunere nouă.');return p;
}
export function flexibleContext(db:Database,jobId:string){const p=flexiblePreference(db,jobId);return p?{windows:JSON.parse(p.windows_json) as FlexibleWindow[],revision:p.revision}:null;}

/** True only when at least one allowed start has actual configured provider capacity. */
export function hasFlexibleCapacity(db:Database,jobId:string,firmId:string){
 const pref=flexiblePreference(db,jobId);if(!pref)return false;
 const teams=db.prepare('SELECT id FROM workspace_teams WHERE firm_id=? AND active=1').all(firmId) as {id:string}[];
 for(const w of JSON.parse(pref.windows_json) as FlexibleWindow[])for(const h of SLOT_HOURS.filter(h=>h>=w.from&&h<=w.to))for(const team of teams){try{prepareFlexibleProposal(db,jobId,firmId,team.id,bucharestScheduledAt(w.date,h).toISOString());return true;}catch(e){if(!(e instanceof FlexibleError))throw e;}}
 return false;
}
