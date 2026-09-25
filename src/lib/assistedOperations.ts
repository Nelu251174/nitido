import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {MarginError} from './operationalMargin';
import {listAssessmentPlans,planAssessment,validateAssessmentPlan} from './assessmentPlan';
import {firmAvailabilityError} from './firmAvailability';
import {firmCoversCity} from './text';
import {bucharestDateKey,bucharestScheduledAt,hasSchedulingLeadTime} from './scheduling';
import {MIN_LEAD_HOURS,SLOT_HOURS} from './pricing';

export const ASSISTED_OPERATIONS_SCHEMA=`
CREATE TABLE IF NOT EXISTS assisted_offer_plans(offer_id TEXT NOT NULL REFERENCES assessment_offers(id),revision INTEGER NOT NULL,assessment_id TEXT NOT NULL,plan_revision INTEGER NOT NULL,public_json TEXT NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(offer_id,revision),FOREIGN KEY(assessment_id,plan_revision) REFERENCES assessment_plans(assessment_id,revision));
CREATE TABLE IF NOT EXISTS assisted_job_plans(job_id TEXT PRIMARY KEY REFERENCES jobs(id),offer_id TEXT NOT NULL,revision INTEGER NOT NULL,FOREIGN KEY(offer_id,revision) REFERENCES assisted_offer_plans(offer_id,revision));
CREATE TRIGGER IF NOT EXISTS assisted_offer_no_update BEFORE UPDATE ON assisted_offer_plans BEGIN SELECT RAISE(ABORT,'Operational proposal immutable'); END;
CREATE TRIGGER IF NOT EXISTS assisted_offer_no_delete BEFORE DELETE ON assisted_offer_plans BEGIN SELECT RAISE(ABORT,'Operational proposal retained'); END;
CREATE TRIGGER IF NOT EXISTS assisted_job_no_update BEFORE UPDATE ON assisted_job_plans BEGIN SELECT RAISE(ABORT,'Operational link immutable'); END;
CREATE TRIGGER IF NOT EXISTS assisted_job_no_delete BEFORE DELETE ON assisted_job_plans BEGIN SELECT RAISE(ABORT,'Operational link retained'); END;
`;
export type AssistedOperation={revision:number;planRevision:number;assessmentVersion:number;category:string;city:string;teamId:string;teamName:string;firmId:string;firmName:string;startsAt:string;scheduledDate:string;scheduledHour:number;durationMinutes:number;bufferMinutes:number;expiresAt:string};
export function latestAssistedOperation(db:Database,offerId:string):AssistedOperation|null {
 const r=db.prepare('SELECT public_json FROM assisted_offer_plans WHERE offer_id=? ORDER BY revision DESC LIMIT 1').get(offerId) as {public_json:string}|undefined;
 return r?JSON.parse(r.public_json):null;
}
export function jobAssistedOperation(db:Database,jobId:string):AssistedOperation|null {
 const r=db.prepare('SELECT p.public_json FROM assisted_job_plans j JOIN assisted_offer_plans p ON p.offer_id=j.offer_id AND p.revision=j.revision WHERE j.job_id=?').get(jobId) as {public_json:string}|undefined;
 return r?JSON.parse(r.public_json):null;
}
type Team={id:string;name:string;firm_id:string;user_id:string;firm_name:string;active:number;verified:number;suspended_until:string|null;coverage_city:string;coverage_cities_extra:string|null;minimum_duration_minutes:number;travel_minutes:number};
export function checkAssistedTeam(db:Database,p:Pick<AssistedOperation,'teamId'|'firmId'|'category'|'city'|'startsAt'|'durationMinutes'|'bufferMinutes'>,jobId='') {
 const t=db.prepare('SELECT t.*,f.user_id,f.verified,f.suspended_until,f.coverage_city,f.coverage_cities_extra,u.name firm_name FROM workspace_teams t JOIN firms f ON f.id=t.firm_id JOIN users u ON u.id=f.user_id WHERE t.id=?').get(p.teamId) as Team|undefined;
 if(!t||t.firm_id!==p.firmId||!t.active||!t.verified||!firmCoversCity(t.coverage_city,t.coverage_cities_extra,p.city)||t.suspended_until&&(!Number.isFinite(Date.parse(t.suspended_until))||Date.parse(t.suspended_until)>Date.now()))throw new MarginError('Echipa sau firma nu mai este eligibilă.',409);
 if(!db.prepare('SELECT 1 FROM service_catalog_firms WHERE firm_id=? AND category_key=? AND enabled=1').get(t.firm_id,p.category))throw new MarginError('Firma nu este asociată serviciului evaluat.',409);
 for(const n of [t.minimum_duration_minutes,t.travel_minutes])if(!Number.isSafeInteger(n)||n<0)throw new MarginError('Configurația duratei echipei este invalidă.',409);
 const duration=Math.max(p.durationMinutes,t.minimum_duration_minutes),buffer=Math.max(p.bufferMinutes,t.travel_minutes),start=Date.parse(p.startsAt),end=start+(duration+buffer)*60000;
 if(!Number.isFinite(start)||!Number.isSafeInteger(duration)||duration<=0||!Number.isSafeInteger(buffer)||buffer<0||!Number.isFinite(new Date(end).getTime()))throw new MarginError('Interval operațional invalid.',409);
 const unavailable=firmAvailabilityError(db,t.firm_id,{id:jobId,scheduled_at:p.startsAt,when_type:'scheduled',duration_minutes:duration,buffer_minutes:buffer});
 if(unavailable)throw new MarginError(unavailable,409);
 const blocks=db.prepare('SELECT starts_at,ends_at FROM workspace_team_blocks WHERE team_id=? AND cancelled=0').all(t.id) as {starts_at:string;ends_at:string}[];
 if(blocks.some(b=>{const a=Date.parse(b.starts_at),z=Date.parse(b.ends_at);return !Number.isFinite(a)||!Number.isFinite(z)||z<=a||a<end&&z>start;}))throw new MarginError('Echipa este indisponibilă în intervalul evaluat.',409);
 return {team:t,duration,buffer};
}
export function proposeAssistedOperation(db:Database,offerId:string,assessmentId:string,input:Record<string,unknown>,actor:string){
 if(!db.inTransaction)throw new MarginError('Este necesară o tranzacție.',500);
 const a=planAssessment(db,assessmentId),plan=listAssessmentPlans(db,assessmentId)[0],last=latestAssistedOperation(db,offerId);
 if(input.revision!==(last?.revision??0)||!plan||input.planRevision!==plan.revision||plan.assessment_version!==a.version)throw new MarginError('Planul sau propunerea s-a modificat. Actualizează.',409);
 if(db.prepare('SELECT 1 FROM assessment_offer_jobs WHERE offer_id=?').get(offerId))throw new MarginError('Rezervarea există deja.',409);
 const d=validateAssessmentPlan(plan.definition);
 if(d.requiredTeams!==1)throw new MarginError('Alocarea actuală permite exact o echipă pe lucrare.',422);
 if(typeof input.teamId!=='string'||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>2000)throw new MarginError('Alege echipa și completează motivul.');
 const t=db.prepare('SELECT firm_id FROM workspace_teams WHERE id=?').get(input.teamId) as {firm_id:string}|undefined;if(!t)throw new MarginError('Echipă inexistentă.',404);
 const context=JSON.parse(a.payload) as {category:string;city:string},day=bucharestDateKey(new Date(d.startsAt));
 const hour=SLOT_HOURS.find(h=>bucharestScheduledAt(day,h).toISOString()===d.startsAt);
 if(hour===undefined||!hasSchedulingLeadTime(new Date(d.startsAt)))throw new MarginError('Planul trebuie să înceapă într-un interval valid din calendarul României.',422);
 const expiry=typeof input.expiresAt==='string'?new Date(input.expiresAt):new Date(NaN);
 if(!Number.isFinite(expiry.getTime())||expiry.toISOString()!==input.expiresAt||expiry.getTime()<=Date.now()||expiry.getTime()>Date.parse(d.startsAt)-MIN_LEAD_HOURS*3600000)throw new MarginError('Termen de confirmare invalid.');
 const checked=checkAssistedTeam(db,{teamId:input.teamId,firmId:t.firm_id,...context,startsAt:d.startsAt,durationMinutes:d.durationMinutes,bufferMinutes:d.bufferMinutes});
 const p:AssistedOperation={revision:(last?.revision??0)+1,planRevision:plan.revision,assessmentVersion:a.version,...context,teamId:input.teamId,teamName:checked.team.name,firmId:t.firm_id,firmName:checked.team.firm_name,startsAt:d.startsAt,scheduledDate:day,scheduledHour:hour,durationMinutes:checked.duration,bufferMinutes:checked.buffer,expiresAt:expiry.toISOString()};
 db.prepare('INSERT INTO assisted_offer_plans VALUES(?,?,?,?,?,?,?,?)').run(offerId,p.revision,assessmentId,plan.revision,JSON.stringify(p),input.reason.trim(),actor,new Date().toISOString());
 return p;
}
export function validateAssistedBooking(db:Database,p:AssistedOperation,assessmentId:string,assessmentVersion:number,body:Record<string,unknown>){
 const plan=listAssessmentPlans(db,assessmentId)[0];
 if(!plan||plan.revision!==p.planRevision||assessmentVersion!==p.assessmentVersion||plan.assessment_version!==assessmentVersion)throw new MarginError('Planul necesită o propunere operațională nouă.',409);
 if(body.assistedRevision!==p.revision||body.whenType!=='scheduled'||body.scheduledDate!==p.scheduledDate||body.scheduledHour!==p.scheduledHour)throw new MarginError('Confirmă planul, echipa și intervalul curent.',409);
 if(Date.parse(p.expiresAt)<=Date.now()||!hasSchedulingLeadTime(new Date(p.startsAt)))throw new MarginError('Propunerea operațională a expirat.',409);
 checkAssistedTeam(db,p);
}
export function reserveAssistedTeam(db:Database,jobId:string,firmId:string){
 const p=jobAssistedOperation(db,jobId);if(!p)return;
 if(!db.inTransaction)throw new MarginError('Alocarea necesită tranzacția acceptării.',500);
 if(p.firmId!==firmId)throw new MarginError('Lucrarea este propusă unei alte firme.',403);
 const j=db.prepare('SELECT scheduled_at,duration_minutes,buffer_minutes FROM jobs WHERE id=?').get(jobId) as {scheduled_at:string;duration_minutes:number;buffer_minutes:number};
 if(j.scheduled_at!==p.startsAt||j.duration_minutes!==p.durationMinutes||j.buffer_minutes!==p.bufferMinutes)throw new MarginError('Programarea diferă de planul confirmat.',409);
 if(Date.parse(p.startsAt)<=Date.now())throw new MarginError('Intervalul a început. Este necesară reprogramarea.',409);
 const {team}=checkAssistedTeam(db,p,jobId);
 db.prepare('INSERT INTO workspace_assignments(job_id,team_id,assigned_by,created_at) VALUES(?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET team_id=excluded.team_id,assigned_by=excluded.assigned_by,created_at=excluded.created_at').run(jobId,p.teamId,team.user_id,new Date().toISOString());
 db.prepare('INSERT INTO workspace_audit VALUES(?,?,?,?,?)').run(randomUUID(),team.user_id,'team.assisted_reserved',jobId,new Date().toISOString());
}
