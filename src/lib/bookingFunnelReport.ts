import type {Database} from 'better-sqlite3';
import {bucharestScheduledAt,bookingDateKey} from './scheduling';
export const FUNNEL_EVENTS=['start','space_valid','schedule_valid','summary_view','account_requested','field_error'] as const;
export const FUNNEL_FIELDS=['space','city','area','bathroomCount','windowsSqm','date','hour'] as const;
export function bookingFunnelReport(db:Database,from:string,to:string){
 if(bookingDateKey(from)!==from||bookingDateKey(to)!==to||from>to)throw new Error('Perioadă invalidă.');
 const end=new Date(to+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);
 const start=bucharestScheduledAt(from,0).toISOString(),stop=bucharestScheduledAt(end.toISOString().slice(0,10),0).toISOString();
 if(Date.parse(stop)-Date.parse(start)>93*86400000)throw new Error('Alege cel mult 92 de zile.');
 const steps=db.prepare("SELECT entity_id event,json_extract(details_json,'$.device') device,json_extract(details_json,'$.field') field,COUNT(*) events,COUNT(DISTINCT actor) sessions FROM pro_audit_logs WHERE action='public.booking_funnel' AND datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?) GROUP BY entity_id,device,field").all(start,stop);
 const jobs=db.prepare("SELECT COUNT(*) published,SUM(CASE WHEN accepted_firm_id IS NOT NULL THEN 1 ELSE 0 END) allocated,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed FROM jobs WHERE datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?)").get(start,stop);
 const leads=db.prepare('SELECT COUNT(*) confirmed FROM pro_leads WHERE datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?)').get(start,stop);
 return {from,to,timezone:'Europe/Bucharest',steps,jobs,leads};
}
