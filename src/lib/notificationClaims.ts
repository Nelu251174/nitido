import {randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';

export const NOTIFICATION_CLAIM_SCHEMA=`
CREATE TABLE IF NOT EXISTS notification_delivery_claims (
 channel TEXT NOT NULL CHECK(channel IN ('push','sms')),
 outbox_id TEXT NOT NULL,
 token TEXT NOT NULL,
 claimed_ms INTEGER NOT NULL,
 dispatch_ms INTEGER,
 PRIMARY KEY(channel,outbox_id)
);`;
export type NotificationChannel='push'|'sms';
export const NOTIFICATION_LEASE_MS=120_000;
export function initializeNotificationClaims(db:Database){
 db.exec(NOTIFICATION_CLAIM_SCHEMA);
 const columns=db.prepare('PRAGMA table_info(notification_outbox)').all() as {name:string}[];
 if(!columns.some(column=>column.name==='recipient_user_id'))db.exec('ALTER TABLE notification_outbox ADD COLUMN recipient_user_id TEXT');
}
const table=(channel:NotificationChannel)=>channel==='push'?'push_notification_outbox':'notification_outbox';
export const retryableNotificationSql=(limit:number)=>`status IN ('pending','failed') AND attempt_count<${limit} AND (last_error IS NULL OR (last_error NOT LIKE 'SUPPRESSED_%' AND last_error<>'DELIVERY_UNKNOWN'))`;

export function claimNotification(db:Database,channel:NotificationChannel,id:string,now=Date.now()):string|null{
 return db.transaction(()=>{
  const changed=db.prepare(`UPDATE ${table(channel)} SET status='sending',attempt_count=attempt_count+1,last_error=NULL WHERE id=? AND ${retryableNotificationSql(channel==='push'?3:5)}`).run(id);
  if(!changed.changes)return null;
  const token=randomUUID();
  db.prepare(`INSERT INTO notification_delivery_claims(channel,outbox_id,token,claimed_ms,dispatch_ms) VALUES(?,?,?,?,NULL)
   ON CONFLICT(channel,outbox_id) DO UPDATE SET token=excluded.token,claimed_ms=excluded.claimed_ms,dispatch_ms=NULL`).run(channel,id,token,now);
  return token;
 }).immediate();
}

/** Persist the boundary before calling the provider. An expired/stale worker cannot dispatch. */
export function startNotificationDispatch(db:Database,channel:NotificationChannel,id:string,token:string,now=Date.now()):boolean{
 return db.prepare(`UPDATE notification_delivery_claims SET dispatch_ms=? WHERE channel=? AND outbox_id=? AND token=? AND dispatch_ms IS NULL AND claimed_ms>? AND EXISTS(SELECT 1 FROM ${table(channel)} WHERE id=? AND status='sending')`).run(now,channel,id,token,now-NOTIFICATION_LEASE_MS,id).changes===1;
}

/** A late authoritative response may resolve quarantine, but never a newer attempt. */
export function finishNotification(db:Database,channel:NotificationChannel,id:string,token:string,result:{providerMessageId:string}|{error:string}):boolean{
 const outcome='providerMessageId' in result&&(typeof result.providerMessageId!=='string'||!result.providerMessageId.trim())?{error:'DELIVERY_UNKNOWN'}:result;
 const sent='providerMessageId' in outcome;
 return db.prepare(`UPDATE ${table(channel)} SET status=?,provider_message_id=?,last_error=?,sent_at=CASE WHEN ? THEN datetime('now') ELSE sent_at END
  WHERE id=? AND (status='sending' OR (status='failed' AND last_error='DELIVERY_UNKNOWN'))
  AND EXISTS(SELECT 1 FROM notification_delivery_claims WHERE channel=? AND outbox_id=? AND token=?)`)
  .run(sent?'sent':'failed',sent?outcome.providerMessageId:null,sent?null:outcome.error,sent?1:0,id,channel,id,token).changes===1;
}

export function recoverNotificationClaims(db:Database,now=Date.now()){
 return db.transaction(()=>{
  const result={recovered:0,quarantined:0};
  for(const channel of ['push','sms'] as const){
   const rows=db.prepare(`SELECT o.id,c.token,c.dispatch_ms FROM ${table(channel)} o LEFT JOIN notification_delivery_claims c ON c.channel=? AND c.outbox_id=o.id
    WHERE o.status='sending' AND ((c.token IS NOT NULL AND c.claimed_ms<=?) OR (c.token IS NULL AND (strftime('%s',o.created_at) IS NULL OR CAST(strftime('%s',o.created_at) AS INTEGER)*1000<=?))) LIMIT 100`)
    .all(channel,now-NOTIFICATION_LEASE_MS,now-NOTIFICATION_LEASE_MS) as {id:string;token:string|null;dispatch_ms:number|null}[];
   for(const row of rows){
    const safe=row.token!==null&&row.dispatch_ms===null;
    db.prepare(`UPDATE ${table(channel)} SET status='failed',last_error=? WHERE id=? AND status='sending'`).run(safe?'INTERRUPTED_BEFORE_DISPATCH':'DELIVERY_UNKNOWN',row.id);
    if(safe){db.prepare('DELETE FROM notification_delivery_claims WHERE channel=? AND outbox_id=? AND token=?').run(channel,row.id,row.token);result.recovered++;}
    else result.quarantined++;
   }
  }
  return result;
 }).immediate();
}
