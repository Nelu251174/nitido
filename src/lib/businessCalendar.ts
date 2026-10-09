import type {JobRow} from './types';
import {intersectsServiceDay} from './calendarView';
export type BusinessLocation={id:string;name:string;kind:string};
export function businessCalendarJobs(jobs:JobRow[],locations:BusinessLocation[],links:{property_id:string;job_id:string}[],filter:{location:string;firm:string;status:string}){
 const eligible=new Map(locations.filter(p=>p.kind==='business'&&(!filter.location||p.id===filter.location)).map(p=>[p.id,p]));
 const byJob=new Map<string,BusinessLocation[]>();
 for(const link of links){const p=eligible.get(link.property_id);if(p){const list=byJob.get(link.job_id)??[];if(!list.some(x=>x.id===p.id))list.push(p);byJob.set(link.job_id,list)}}
 return jobs.filter(j=>byJob.has(j.id)&&(!filter.firm||(filter.firm==='unassigned'?!j.accepted_firm_id:j.accepted_firm_id===filter.firm))&&(!filter.status||j.status===filter.status)).map(job=>({job,locations:byJob.get(job.id)!}));
}
export function businessJobEnd(job:JobRow){const start=Date.parse(job.scheduled_at??'');const duration=job.duration_minutes;if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0)return null;const end=new Date(start+duration*60000);return Number.isFinite(end.getTime())?end.toISOString():null}
export function businessJobOnDay(job:JobRow,day:string){const end=businessJobEnd(job);return Boolean(end&&job.scheduled_at&&intersectsServiceDay(job.scheduled_at,end,day))}
