import {randomUUID} from 'node:crypto';
import type {AdminIdentity} from './adminRolesShared';
import type {Database} from 'better-sqlite3';

/** No automatic positive capacity. An administrator must verify an existing physical crew. */
export const INTERNATIONAL_CREW_CAPACITY_SCHEMA=`CREATE TABLE IF NOT EXISTS international_team_capacity (
 team_id TEXT PRIMARY KEY REFERENCES workspace_teams(id),
 firm_id TEXT NOT NULL REFERENCES firms(id),
 verified_workers INTEGER NOT NULL CHECK(verified_workers BETWEEN 1 AND 100),
 verified_by TEXT NOT NULL,
 verified_at TEXT NOT NULL,
 valid_until TEXT NOT NULL,
 verification_reference TEXT NOT NULL CHECK(length(trim(verification_reference))>=8),
 revoked_at TEXT
);`;
export function ensureInternationalCrewCapacitySchema(db:Database){db.exec(INTERNATIONAL_CREW_CAPACITY_SCHEMA);}
export type CrewJob={id?:string;scheduled_at?:string|null;when_type?:string;duration_minutes?:number;buffer_minutes?:number};
type Team={id:string;verified_workers:number;verified_at:string;valid_until:string;minimum_duration_minutes:number;travel_minutes:number};
function stamp(value:string|null|undefined):number{return value?Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value.replace(' ','T')+'Z'):NaN;}
function occupied(job:CrewJob){const start=stamp(job.scheduled_at),duration=job.duration_minutes,buffer=job.buffer_minutes??0;if(!Number.isSafeInteger(duration)||duration!<1||!Number.isSafeInteger(buffer)||buffer<0||!Number.isFinite(start))return null;return {start,end:start+(duration!+buffer)*60000};}
/** Capacity is a persisted, expiring ADMIN attestation, never membership, coverage or Connect status. */
export function internationalCrewTeam(db:Database,job:CrewJob,firmId:string,workers:number,now=Date.now()):string|null{
 if(!Number.isSafeInteger(workers)||workers<1||workers>100||!Number.isSafeInteger(job.duration_minutes)||job.duration_minutes!<180)return null;
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='international_team_capacity'").get())return null;
 const assigned=job.id?db.prepare('SELECT team_id FROM workspace_assignments WHERE job_id=?').get(job.id) as {team_id:string}|undefined:undefined;
 const teams=db.prepare(`SELECT t.id,c.verified_workers,c.verified_at,c.valid_until,t.minimum_duration_minutes,t.travel_minutes
 FROM workspace_teams t JOIN international_team_capacity c ON c.team_id=t.id AND c.firm_id=t.firm_id

 WHERE t.firm_id=? AND t.active=1 AND c.revoked_at IS NULL AND c.verified_workers>=?
 AND (c.verified_by='bootstrap_admin' OR EXISTS(SELECT 1 FROM admin_staff verifier WHERE verifier.id=c.verified_by AND verifier.role='super_admin' AND verifier.active=1))
 AND length(trim(c.verification_reference))>=8 ORDER BY t.id`).all(firmId,workers) as Team[];
 for(const team of teams){
  if(assigned&&assigned.team_id!==team.id)continue;
  if(!Number.isSafeInteger(team.minimum_duration_minutes)||team.minimum_duration_minutes<0||team.minimum_duration_minutes>job.duration_minutes!||!Number.isSafeInteger(team.travel_minutes)||team.travel_minutes<0)continue;
  const checked=stamp(team.verified_at),until=stamp(team.valid_until);
  if(!Number.isFinite(checked)||!Number.isFinite(until)||checked>now||until<=now||until<=checked)continue;
  const candidate=occupied({...job,scheduled_at:job.scheduled_at??(job.when_type==='asap'?new Date(now).toISOString():null),duration_minutes:Math.max(job.duration_minutes!,team.minimum_duration_minutes??0),buffer_minutes:Math.max(job.buffer_minutes??0,team.travel_minutes??0)});
  if(!candidate||until<candidate.end)continue;
  const blocks=db.prepare('SELECT starts_at,ends_at FROM workspace_team_blocks WHERE team_id=? AND cancelled=0').all(team.id) as {starts_at:string;ends_at:string}[];
  if(blocks.some(b=>{const start=stamp(b.starts_at),end=stamp(b.ends_at);return !Number.isFinite(start)||!Number.isFinite(end)||end<=start||(candidate.start<end&&start<candidate.end);}))continue;
  const others=db.prepare(`SELECT j.id,j.scheduled_at,j.duration_minutes,j.buffer_minutes FROM workspace_assignments a JOIN jobs j ON j.id=a.job_id WHERE a.team_id=? AND j.status IN ('accepted','arrived') AND j.id!=?`).all(team.id,job.id??'') as CrewJob[];
  if(others.some(other=>{const interval=occupied({...other,duration_minutes:Math.max(other.duration_minutes??0,team.minimum_duration_minutes??0),buffer_minutes:Math.max(other.buffer_minutes??0,team.travel_minutes??0)});return !interval||(candidate.start<interval.end&&interval.start<candidate.end);}))continue;
  return team.id;
 }
 return null;
}
/** Call only inside the writer transaction that claims the job. No notifications or financial calls. */
export function reserveInternationalCrew(db:Database,job:CrewJob,firmId:string,workers:number){
 if(!db.inTransaction||!job.id)throw Error('INTERNATIONAL_CREW_TRANSACTION_REQUIRED');
 const teamId=internationalCrewTeam(db,job,firmId,workers);if(!teamId)throw Error('INTERNATIONAL_CREW_UNAVAILABLE');
 const firm=db.prepare('SELECT user_id FROM firms WHERE id=?').get(firmId) as {user_id:string}|undefined;if(!firm)throw Error('INTERNATIONAL_CREW_UNAVAILABLE');
 db.prepare('INSERT INTO workspace_assignments(job_id,team_id,assigned_by,created_at) VALUES(?,?,?,?) ON CONFLICT(job_id) DO NOTHING').run(job.id,teamId,firm.user_id,new Date(Date.now()).toISOString());
 return teamId;
}

/** Called by authenticated ADMIN service code only; no public mutation endpoint exists. */
export function attestInternationalCrewCapacity(db:Database,actor:AdminIdentity,input:{teamId:string;firmId:string;workers:number;validUntil:string;reference:string},now=Date.now()){
 if(!db.inTransaction)throw Error('INTERNATIONAL_CREW_TRANSACTION_REQUIRED');
 const staff=actor.id==='bootstrap_admin'&&actor.revision===0||!!db.prepare("SELECT 1 FROM admin_staff WHERE id=? AND role='super_admin' AND active=1 AND revision=?").get(actor.id,actor.revision);
 if(actor.role!=='super_admin'||!staff)throw Error('INTERNATIONAL_CREW_ADMIN_REQUIRED');
 const until=stamp(input.validUntil);
 if(!Number.isSafeInteger(input.workers)||input.workers<1||input.workers>100||!Number.isFinite(until)||until<=now||typeof input.reference!=='string'||input.reference.trim().length<8||input.reference.length>2000)throw Error('INTERNATIONAL_CREW_VERIFICATION_INVALID');
 if(!db.prepare('SELECT 1 FROM workspace_teams WHERE id=? AND firm_id=? AND active=1').get(input.teamId,input.firmId))throw Error('INTERNATIONAL_CREW_TEAM_MISMATCH');
 db.prepare(`INSERT INTO international_team_capacity(team_id,firm_id,verified_workers,verified_by,verified_at,valid_until,verification_reference,revoked_at) VALUES(?,?,?,?,?,?,?,NULL) ON CONFLICT(team_id) DO UPDATE SET firm_id=excluded.firm_id,verified_workers=excluded.verified_workers,verified_by=excluded.verified_by,verified_at=excluded.verified_at,valid_until=excluded.valid_until,verification_reference=excluded.verification_reference,revoked_at=NULL`).run(input.teamId,input.firmId,input.workers,actor.id,new Date(now).toISOString(),new Date(until).toISOString(),input.reference.trim());
 db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'international_crew_capacity_verified',input.teamId,JSON.stringify({actorId:actor.id,firmId:input.firmId,workers:input.workers,validUntil:new Date(until).toISOString()}));
}
