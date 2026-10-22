import {randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {bucharestDateKey} from './scheduling';
import {RetentionError} from './clientRetention';
export function retentionEvent(db:Database,clientId:string,kind:unknown,resource:unknown){
  if(!['repeat_open','alert_open'].includes(String(kind))||typeof resource!=='string'||!resource||resource.length>100)throw new RetentionError('Eveniment invalid.',400);
  const allowed=kind==='repeat_open'?db.prepare("SELECT 1 FROM jobs WHERE id=? AND client_id=? AND status='completed'").get(resource,clientId):db.prepare('SELECT 1 FROM availability_alert_batches WHERE id=? AND client_id=?').get(resource,clientId);
  if(!allowed)throw new RetentionError('Resursă indisponibilă.',404);
  db.prepare('INSERT OR IGNORE INTO retention_events VALUES(?,?,?,?,?,?)').run(randomUUID(),clientId,kind,resource,bucharestDateKey(new Date()),new Date().toISOString());
}
export function retentionMetrics(db:Database){
  const n=(q:string)=>(db.prepare(q).get() as {n:number}).n;
  const pipeline=(table:string)=>db.prepare(`SELECT COUNT(*) created,COALESCE(SUM(j.accepted_firm_id IS NOT NULL),0) allocated,COALESCE(SUM(j.status='completed'),0) completed,
    COALESCE(SUM(EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')),0) captured FROM ${table} r JOIN jobs j ON j.id=r.job_id`).get();
  return {checkedAt:new Date().toISOString(),favorites:n('SELECT COUNT(*) n FROM client_favorite_firms'),preferredRequests:pipeline('job_preferred_requests'),repeatBookings:pipeline('job_repeat_origins'),alertBookings:pipeline('job_availability_origins'),opens:db.prepare('SELECT kind,COUNT(*) n FROM retention_events GROUP BY kind').all(),activeSubscriptions:(db.prepare('SELECT COUNT(*) n FROM availability_subscriptions WHERE active=1 AND expires_at>?').get(new Date().toISOString()) as {n:number}).n,
    deliveries:db.prepare('SELECT channel,status,COUNT(*) n FROM availability_alert_deliveries GROUP BY channel,status').all(),pilot:db.prepare("SELECT city FROM feature_pilots WHERE feature_key='weekly'").get()??null,
    futureSlots:db.prepare('SELECT city,COUNT(*) total,SUM(approved_at IS NOT NULL) approved FROM provider_open_slots WHERE active=1 AND ends_at>? GROUP BY city').all(new Date().toISOString())};
}
