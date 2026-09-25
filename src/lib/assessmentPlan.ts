import type {Database} from 'better-sqlite3';
import {catalogCapacity} from './catalogCapacity';
import {firmAvailabilityError} from './firmAvailability';
import {MarginError} from './operationalMargin';

export const ASSESSMENT_PLAN_SCHEMA=`
CREATE TABLE IF NOT EXISTS assessment_plans (
 assessment_id TEXT NOT NULL REFERENCES service_assessments(id),revision INTEGER NOT NULL,
 assessment_version INTEGER NOT NULL,definition_json TEXT NOT NULL,capacity_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(assessment_id,revision)
);
CREATE TRIGGER IF NOT EXISTS assessment_plan_no_update BEFORE UPDATE ON assessment_plans BEGIN SELECT RAISE(ABORT,'Plan immutable'); END;
CREATE TRIGGER IF NOT EXISTS assessment_plan_no_delete BEFORE DELETE ON assessment_plans BEGIN SELECT RAISE(ABORT,'Plan retained'); END;
`;
export type AssessmentPlanDefinition={startsAt:string;durationMinutes:number;bufferMinutes:number;requiredTeams:number;source:string;reason:string};
type Assessment={id:string;version:number;status:string;payload:string};
export function planAssessment(db:Database,id:unknown){
 if(typeof id!=='string'||!id||id.length>100)throw new MarginError('Referință cerere invalidă.');
 const a=db.prepare('SELECT id,version,status,payload FROM service_assessments WHERE id=?').get(id) as Assessment|undefined;
 if(!a)throw new MarginError('Cerere inexistentă.',404);return a;
}
export function validateAssessmentPlan(input:unknown,now=new Date()):AssessmentPlanDefinition {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new MarginError('Plan invalid.');
 const v=input as Record<string,unknown>;
 for(const [key,min,max] of [['durationMinutes',1,10080],['bufferMinutes',0,10080],['requiredTeams',1,100]] as const){if(!Number.isSafeInteger(v[key])||Number(v[key])<min||Number(v[key])>max)throw new MarginError('Completează durata, deplasarea și numărul de echipe cu valori întregi valide.');}
 if(typeof v.startsAt!=='string')throw new MarginError('Completează data de început.');
 const start=new Date(v.startsAt);
 if(!Number.isFinite(start.getTime())||start.toISOString()!==v.startsAt||start<=now)throw new MarginError('Începutul trebuie să fie o dată viitoare validă, cu fus orar.');
 for(const key of ['source','reason'])if(typeof v[key]!=='string'||!v[key].trim()||v[key].length>2000)throw new MarginError('Completează sursa duratei și motivul planificării.');
 return {startsAt:start.toISOString(),durationMinutes:Number(v.durationMinutes),bufferMinutes:Number(v.bufferMinutes),requiredTeams:Number(v.requiredTeams),source:(v.source as string).trim(),reason:(v.reason as string).trim()};
}
export function assessmentPlanCapacity(db:Database,a:Assessment,d:AssessmentPlanDefinition,now=new Date()){
 const context=JSON.parse(a.payload) as {category:string;city:string};
 const start=Date.parse(d.startsAt);
 const firms=catalogCapacity(db,context.category,context.city,undefined,now.getTime()).map(f=>{
  const reasons=[...f.reasons];
  const teams=db.prepare('SELECT id,minimum_duration_minutes,travel_minutes FROM workspace_teams WHERE firm_id=? AND active=1').all(f.id) as {id:string;minimum_duration_minutes:number;travel_minutes:number}[];
  const checks=teams.map(t=>{
   if(!Number.isSafeInteger(t.minimum_duration_minutes)||t.minimum_duration_minutes<0||!Number.isSafeInteger(t.travel_minutes)||t.travel_minutes<0)return {teamId:t.id,available:false,endsAt:null,reason:'Durata minimă sau deplasarea echipei este necunoscută/invalidă.'};
   const duration=Math.max(d.durationMinutes,t.minimum_duration_minutes),buffer=Math.max(d.bufferMinutes,t.travel_minutes),end=start+(duration+buffer)*60000;
   if(!Number.isSafeInteger(end)||!Number.isFinite(new Date(end).getTime()))return {teamId:t.id,available:false,endsAt:null,reason:'Intervalul echipei nu poate fi calculat.'};
   const firmError=firmAvailabilityError(db,f.id,{id:'',scheduled_at:d.startsAt,when_type:'scheduled',duration_minutes:duration,buffer_minutes:buffer});
   const blocks=db.prepare('SELECT starts_at,ends_at FROM workspace_team_blocks WHERE team_id=? AND cancelled=0').all(t.id) as {starts_at:string;ends_at:string}[];
   const blocked=blocks.some(b=>{const x=Date.parse(b.starts_at),y=Date.parse(b.ends_at);return !Number.isFinite(x)||!Number.isFinite(y)||y<=x||x<end&&y>start;});
   const reason=firmError??(blocked?'Echipa are un interval indisponibil sau neconfirmat.':null);
   return {teamId:t.id,available:!reason,endsAt:new Date(end).toISOString(),reason};
  });
  const availableTeams=checks.filter(t=>t.available).length;
  if(availableTeams<d.requiredTeams)reasons.push('Număr insuficient de echipe fără suprapuneri pentru durata evaluată.');
  return {id:f.id,name:f.name,eligible:reasons.length===0,availableTeams,reasons,teams:checks};
 });
 return {checkedAt:now.toISOString(),category:context.category,city:context.city,startsAt:d.startsAt,requestedEndsAt:new Date(start+(d.durationMinutes+d.bufferMinutes)*60000).toISOString(),requiredTeams:d.requiredTeams,eligibleFirms:firms.filter(f=>f.eligible).length,capacityReserved:false as const,firms};
}
export type SavedAssessmentPlan={revision:number;assessment_version:number;definition:AssessmentPlanDefinition;capacity:ReturnType<typeof assessmentPlanCapacity>;actor_id:string;created_at:string};
export function listAssessmentPlans(db:Database,id:string):SavedAssessmentPlan[]{
 return (db.prepare('SELECT * FROM assessment_plans WHERE assessment_id=? ORDER BY revision DESC LIMIT 50').all(id) as {revision:number;assessment_version:number;definition_json:string;capacity_json:string;actor_id:string;created_at:string}[]).map(r=>({revision:r.revision,assessment_version:r.assessment_version,definition:JSON.parse(r.definition_json),capacity:JSON.parse(r.capacity_json),actor_id:r.actor_id,created_at:r.created_at}));
}
export function saveAssessmentPlan(db:Database,input:Record<string,unknown>,actor:string,now=new Date()){
 if(!db.inTransaction)throw new MarginError('Planul și auditul necesită aceeași tranzacție.',500);
 const a=planAssessment(db,input.id);
 if(['cancelled','declined'].includes(a.status))throw new MarginError('Cererea este închisă.',409);
 const last=listAssessmentPlans(db,a.id)[0];
 if(input.assessmentVersion!==a.version||input.revision!==(last?.revision??0))throw new MarginError('Cererea sau planul s-a modificat. Actualizează datele.',409);
 const definition=validateAssessmentPlan(input.definition,now),capacity=assessmentPlanCapacity(db,a,definition,now);
 db.prepare('INSERT INTO assessment_plans VALUES(?,?,?,?,?,?,?)').run(a.id,(last?.revision??0)+1,a.version,JSON.stringify(definition),JSON.stringify(capacity),actor,now.toISOString());
 return listAssessmentPlans(db,a.id)[0];
}
