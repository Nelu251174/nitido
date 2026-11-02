import type {Database} from 'better-sqlite3';
import {emailTechnicalId,type EmailResult} from './email';

export const EMAIL_DELIVERY_DIAGNOSTIC_SCHEMA=`
CREATE TABLE IF NOT EXISTS email_delivery_diagnostics(
 correlation_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,created_at INTEGER NOT NULL,
 stage TEXT NOT NULL,category TEXT NOT NULL,http_status INTEGER,provider_message_id TEXT,
 accepted INTEGER NOT NULL,attempts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS email_delivery_diagnostics_created ON email_delivery_diagnostics(created_at);
CREATE INDEX IF NOT EXISTS email_delivery_diagnostics_user ON email_delivery_diagnostics(user_id,created_at);
`;
const stages=new Set(['configuration','site','verification','provider','transport']);
const categories=new Set(['not_configured','invalid_sender','invalid_site','token_issue_failed','provider_accepted','provider_unauthorized','provider_forbidden','provider_rate_limited','provider_unavailable','provider_rejected','transport_timeout','transport_error']);
const timestamp=(value:number)=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():null};

/** No recipient, payload, token/hash, secret or private exception text enters this table. */
export function recordEmailDiagnostic(db:Database,userId:string,result:EmailResult,now=Date.now()):boolean {
  try{
    db.transaction(()=>{
      db.prepare(`INSERT INTO email_delivery_diagnostics(correlation_id,user_id,created_at,stage,category,http_status,provider_message_id,accepted,attempts) VALUES(?,?,?,?,?,?,?,?,?)`).run(result.correlationId,userId,now,result.stage,result.category,result.httpStatus,result.messageId,result.accepted?1:0,result.attempts);
      db.prepare('DELETE FROM email_delivery_diagnostics WHERE created_at<?').run(now-30*86400000);
      db.prepare('DELETE FROM email_delivery_diagnostics WHERE correlation_id NOT IN (SELECT correlation_id FROM email_delivery_diagnostics ORDER BY created_at DESC,correlation_id DESC LIMIT 2000)').run();
    })();
    return true;
  }catch{return false}
}

export function emailDiagnostics(db:Database,limit=50,now=Date.now()) {
  const boundedLimit=Number.isInteger(limit)&&limit>=1&&limit<=100?limit:50;
  const rows=db.prepare('SELECT correlation_id,created_at,stage,category,http_status,provider_message_id,accepted,attempts FROM email_delivery_diagnostics WHERE created_at>=? ORDER BY created_at DESC,correlation_id DESC LIMIT ?').all(now-30*86400000,boundedLimit) as {correlation_id:unknown;created_at:number;stage:unknown;category:unknown;http_status:unknown;provider_message_id:unknown;accepted:number;attempts:number}[];
  const counts=db.prepare('SELECT accepted,COUNT(*) AS count FROM email_delivery_diagnostics WHERE created_at>=? GROUP BY accepted').all(now-30*86400000) as {accepted:number;count:number}[];
  return {windowDays:30,providerAcceptanceOnly:true,deliveryConfirmed:false,counts:{accepted:counts.find(r=>r.accepted===1)?.count??0,unavailable:counts.find(r=>r.accepted===0)?.count??0},items:rows.map(row=>({
    correlationId:emailTechnicalId(row.correlation_id),createdAt:timestamp(row.created_at),
    stage:typeof row.stage==='string'&&stages.has(row.stage)?row.stage:'unknown',category:typeof row.category==='string'&&categories.has(row.category)?row.category:'unknown',
    httpStatus:typeof row.http_status==='number'&&Number.isInteger(row.http_status)&&row.http_status>=100&&row.http_status<=599?row.http_status:null,
    messageId:emailTechnicalId(row.provider_message_id),accepted:row.accepted===1,attempts:Number.isInteger(row.attempts)&&row.attempts>=0&&row.attempts<=2?row.attempts:null,
  }))};
}
