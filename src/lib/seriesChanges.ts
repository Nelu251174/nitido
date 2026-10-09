import type {Database} from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {computeNextDate,validateRecurringPlan,type Frequency} from './recurring';
import {bucharestScheduledAt} from './scheduling';
import {proposeReschedule} from './rescheduling';
import {WorkspaceError} from './workspace';
import type {JobRow} from './types';
export type SeriesChangeInput={fromJobId:string;date:string;hour:number;frequency:Frequency;revision?:string};
function preview(db:Database,clientId:string,planId:string,input:SeriesChangeInput){
 if(!input||typeof input.fromJobId!=='string'||input.fromJobId.length>200)throw new WorkspaceError('Vizită invalidă.');
 const plan=db.prepare('SELECT * FROM recurring_plans WHERE id=? AND client_id=?').get(planId,clientId) as {status:string;street:string;city:string;sqm:number;space_type:'apartament';end_date:string|null;frequency:Frequency;hour:number;next_run_date:string}|undefined;
 if(!plan)throw new WorkspaceError('Serie inexistentă.',404);
 if(plan.status!=='active')throw new WorkspaceError('Reia seria înainte de a modifica programul.',409);
 const invalid=validateRecurringPlan({clientId,street:plan.street,city:plan.city,sqm:plan.sqm,spaceType:plan.space_type,frequency:input.frequency,hour:input.hour,startDate:input.date});
 if(invalid)throw new WorkspaceError(invalid.error,invalid.status);
 const from=db.prepare('SELECT j.scheduled_at FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND o.job_id=?').get(planId,input.fromJobId) as {scheduled_at:string}|undefined;
 if(!from)throw new WorkspaceError('Vizită inexistentă în serie.',404);
 const jobs=db.prepare(`SELECT j.* FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND j.scheduled_at>=? AND j.client_id=? AND j.status NOT IN ('cancelled','no_show') ORDER BY j.scheduled_at,o.job_id`).all(planId,from.scheduled_at,clientId) as JobRow[];
 if(!jobs.length||jobs.length>90)throw new WorkspaceError('Selectează un grup de maximum 90 de vizite.',409);
 const pause=db.prepare('SELECT start_date,end_date FROM recurring_pauses WHERE plan_id=?').get(planId) as {start_date:string;end_date:string}|undefined;
 let date=input.date;
 const visits=jobs.map(j=>{
  if(!['waiting','accepted'].includes(j.status)||!j.scheduled_at||Date.parse(j.scheduled_at)<=Date.now())throw new WorkspaceError('Grupul conține o vizită începută sau trecută. Alege prima vizită viitoare.',409);
  if(plan.end_date&&date>plan.end_date)throw new WorkspaceError('Noul program depășește data de sfârșit a seriei. Modifică mai întâi limita seriei.',409);
  if(pause&&date>=pause.start_date&&date<=pause.end_date)throw new WorkspaceError('Noul program include o pauză activă. Alege alte date sau modifică pauza.',409);
  const target=bucharestScheduledAt(date,input.hour).toISOString();
  if(Date.parse(target)<Date.now()+3600000||Date.parse(target)>Date.now()+366*86400000)throw new WorkspaceError('Toate vizitele trebuie să fie cu minimum o oră înainte, în următoarele 12 luni.');
  const result={jobId:j.id,originalAt:j.scheduled_at,proposedAt:target,date,status:j.status,firmConfirmation:j.status==='accepted'&&target!==j.scheduled_at};
  date=computeNextDate(input.frequency,new Date(`${date}T12:00:00Z`),Number(input.date.slice(8,10)));
  return result;
 });
 const boundary=visits[0].proposedAt;
 const prior=db.prepare(`SELECT j.scheduled_at,j.duration_minutes,j.buffer_minutes FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND j.scheduled_at<? AND j.status IN ('waiting','accepted','arrived')`).all(planId,from.scheduled_at) as JobRow[];
 if(prior.some(j=>!j.scheduled_at||Date.parse(j.scheduled_at)+(j.duration_minutes+j.buffer_minutes)*60000>Date.parse(boundary)))throw new WorkspaceError('Noul program se suprapune cu o vizită anterioară a seriei.',409);
 const revision=createHash('sha256').update(JSON.stringify([plan,pause,jobs.map(j=>[j.id,j.status,j.scheduled_at,j.accepted_firm_id,j.duration_minutes,j.buffer_minutes]),input.date,input.hour,input.frequency])).digest('hex');
 return {visits,revision,nextDate:date};
}
export function previewSeriesChange(db:Database,clientId:string,planId:string,input:SeriesChangeInput){return db.transaction(()=>preview(db,clientId,planId,input))();}
export function applySeriesChange(db:Database,clientId:string,planId:string,input:SeriesChangeInput){
 return db.transaction(()=>{
  const change=preview(db,clientId,planId,input);
  if(input.revision!==change.revision)throw new WorkspaceError('Seria s-a modificat. Verifică din nou propunerea.',409);
  for(const visit of change.visits)if(visit.originalAt!==visit.proposedAt)proposeReschedule(db,visit.jobId,{id:clientId,role:'client'},{date:visit.date,hour:input.hour,expectedAt:visit.originalAt});
  db.prepare('UPDATE recurring_plans SET frequency=?,hour=?,next_run_date=?,anchor_day=?,schedule_generation=schedule_generation+1 WHERE id=? AND client_id=?').run(input.frequency,input.hour,change.nextDate,Number(input.date.slice(8,10)),planId,clientId);
  return {ok:true,visits:change.visits};
 }).immediate();
}
