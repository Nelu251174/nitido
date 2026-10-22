import type {Database} from 'better-sqlite3';
import {bookingDateKey,bucharestDateKey,bucharestScheduledAt} from './scheduling';
import {AvailabilityError} from './weeklyAvailability';

export function shiftPlanningDate(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
type Job={id:string;city:string;scheduled_at:string|null;status:string;duration_minutes:number;buffer_minutes:number;minimum_duration_minutes:number|null;travel_minutes:number|null};
type Slot={id:string;team_id:string;team_name:string;team_active:number;city:string;starts_at:string;ends_at:string;approved_at:string|null};
type Block={team_id:string;starts_at:string;ends_at:string};
const overlaps=(a:number,b:number,c:number,d:number)=>a<d&&c<b;
function jobEnd(j:Job){return Date.parse(j.scheduled_at??'')+(Math.max(j.duration_minutes,j.minimum_duration_minutes??0)+Math.max(j.buffer_minutes,j.travel_minutes??0))*60000;}
function validJob(j:Job){return Number.isSafeInteger(j.duration_minutes)&&j.duration_minutes>0&&Number.isSafeInteger(j.buffer_minutes)&&j.buffer_minutes>=0&&Number.isFinite(jobEnd(j));}

/** Read-only planning, scoped to one authenticated firm. No availability reservation. */
export function providerPlanning(db:Database,firmId:string,from:unknown,now=new Date()){
 const today=bucharestDateKey(now),date=from??today;
 if(typeof date!=='string'||date.length!==10||bookingDateKey(date)!==date||date<today||date>shiftPlanningDate(today,365))throw new AvailabilityError('Alege o dată validă în următoarele 12 luni.',400);
 const firm=db.prepare('SELECT id FROM firms WHERE id=?').get(firmId);
 if(!firm)throw new AvailabilityError('Firmă inexistentă.',404);
 const endDate=shiftPlanningDate(date,7),start=bucharestScheduledAt(date,0).toISOString(),end=bucharestScheduledAt(endDate,0).toISOString();
 // Existing conservative capacity rules also consider unfinished work outside the visible week.
 const jobs=db.prepare(`SELECT j.id,j.city,j.scheduled_at,j.status,j.duration_minutes,j.buffer_minutes,t.minimum_duration_minutes,t.travel_minutes
 FROM jobs j LEFT JOIN workspace_assignments a ON a.job_id=j.id
 LEFT JOIN workspace_teams t ON t.id=a.team_id AND t.firm_id=j.accepted_firm_id AND t.active=1
 WHERE j.accepted_firm_id=? AND j.status IN ('accepted','arrived') ORDER BY j.scheduled_at,j.id LIMIT 1001`).all(firmId) as Job[];
 const truncated=jobs.length>1000;
 const unplanned=jobs.filter(j=>!validJob(j)).length;
 const visibleJobs=jobs.filter(j=>validJob(j)&&overlaps(Date.parse(j.scheduled_at!),jobEnd(j),Date.parse(start),Date.parse(end)));
 const slots=db.prepare(`SELECT s.id,s.team_id,t.name team_name,t.active team_active,s.city,s.starts_at,s.ends_at,s.approved_at
 FROM provider_open_slots s JOIN workspace_teams t ON t.id=s.team_id AND t.firm_id=s.firm_id
 WHERE s.firm_id=? AND s.active=1 AND s.starts_at<? AND s.ends_at>? ORDER BY s.starts_at,s.id LIMIT 501`).all(firmId,end,start) as Slot[];
 const blocks=db.prepare(`SELECT b.team_id,b.starts_at,b.ends_at FROM workspace_team_blocks b JOIN workspace_teams t ON t.id=b.team_id
 WHERE t.firm_id=? AND b.cancelled=0 AND b.starts_at<? AND b.ends_at>? ORDER BY b.starts_at LIMIT 1001`).all(firmId,end,start) as Block[];
 const incomplete=truncated||slots.length>500||blocks.length>1000;
 const openings=slots.slice(0,500).map(s=>{
  const conflicts=visibleJobs.filter(j=>overlaps(Date.parse(s.starts_at),Date.parse(s.ends_at),Date.parse(j.scheduled_at!),jobEnd(j))).length;
  const blocked=blocks.some(b=>b.team_id===s.team_id&&overlaps(Date.parse(s.starts_at),Date.parse(s.ends_at),Date.parse(b.starts_at),Date.parse(b.ends_at)));
  return {...s,conflicts,blocked,needsReview:incomplete||unplanned>0||!s.team_active||conflicts>0||blocked};
 });
 return {from:date,to:shiftPlanningDate(date,6),timezone:'Europe/Bucharest',checkedAt:now.toISOString(),incomplete,unplanned,
  days:Array.from({length:7},(_,i)=>{const key=shiftPlanningDate(date,i),a=bucharestScheduledAt(key,0).getTime(),b=bucharestScheduledAt(shiftPlanningDate(key,1),0).getTime();return {date:key,
   jobs:visibleJobs.filter(j=>overlaps(a,b,Date.parse(j.scheduled_at!),jobEnd(j))).map(j=>({id:j.id,city:j.city,startsAt:j.scheduled_at!,endsAt:new Date(jobEnd(j)).toISOString(),status:j.status})),
   openings:openings.filter(s=>overlaps(a,b,Date.parse(s.starts_at),Date.parse(s.ends_at))),
   blockedTeams:[...new Set(blocks.filter(x=>overlaps(a,b,Date.parse(x.starts_at),Date.parse(x.ends_at))).map(x=>x.team_id))].length};})};
}
export type ProviderPlanning=ReturnType<typeof providerPlanning>;
