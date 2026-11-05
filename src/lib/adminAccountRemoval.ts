import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
export class AccountRemovalError extends Error {constructor(message:string,public status=400){super(message);}}
export const ACCOUNT_REMOVAL_SCHEMA=`CREATE TABLE IF NOT EXISTS admin_removed_accounts(
 user_id TEXT PRIMARY KEY REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('firm','client')),
 target_id TEXT NOT NULL,name TEXT NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL,removed_at TEXT NOT NULL,
 UNIQUE(kind,target_id)
);
CREATE TRIGGER IF NOT EXISTS admin_removed_accounts_immutable_update BEFORE UPDATE ON admin_removed_accounts BEGIN SELECT RAISE(ABORT,'Removal history is retained');END;
CREATE TRIGGER IF NOT EXISTS admin_removed_accounts_immutable_delete BEFORE DELETE ON admin_removed_accounts BEGIN SELECT RAISE(ABORT,'Removal history is retained');END;`;
type Input={kind:'firm'|'client';targetId:string;confirmName:string;reason:string};
type Target={userId:string;name:string;firmId:string|null};
const fail=(message:string,status=400):never=>{throw new AccountRemovalError(message,status);};
function validate(value:unknown):Input {
 if(!value||typeof value!=='object'||Array.isArray(value))return fail('Date invalide.');
 const b=value as Record<string,unknown>;
 if(b.kind!=='firm'&&b.kind!=='client')return fail('Tip de cont invalid.');
 for(const [key,max] of [['targetId',100],['confirmName',200],['reason',1000]] as const)if(typeof b[key]!=='string'||!(b[key] as string).trim()||(b[key] as string).length>max)return fail('Identificatorul, numele de confirmare și motivul sunt obligatorii.');
 return {kind:b.kind,targetId:(b.targetId as string).trim(),confirmName:(b.confirmName as string).trim(),reason:(b.reason as string).trim()};
}
const table=(db:Database,name:string)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
function target(db:Database,b:Input):Target {
 const r=b.kind==='firm'?db.prepare("SELECT u.id userId,u.name,f.id firmId FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=? AND u.role='firma'").get(b.targetId):db.prepare("SELECT id userId,name,NULL firmId FROM users WHERE id=? AND role='client'").get(b.targetId);
 if(!r)return fail('Contul nu există sau tipul selectat nu corespunde.',404);
 const t=r as Target;if(t.name.trim()!==b.confirmName)return fail('Numele de confirmare nu corespunde. Reîncarcă lista și verifică rândul selectat.',409);
 if(t.firmId&&(db.prepare('SELECT COUNT(*) n FROM firms WHERE user_id=?').get(t.userId) as {n:number}).n!==1)return fail('Contul gestionează mai multe firme. Este necesară verificarea lui înainte de ștergere.',409);
 return t;
}
function guard(db:Database,t:Target) {
 const predicate=t.firmId?'j.accepted_firm_id=?':'j.client_id=?',key=t.firmId??t.userId;
 if(db.prepare(`SELECT 1 FROM jobs j WHERE ${predicate} AND j.status NOT IN ('completed','cancelled','no_show') LIMIT 1`).get(key))return fail('Contul are lucrări în desfășurare sau programate. Soluționează-le înainte de ștergere.',409);
 if(table(db,'payments')&&db.prepare(`SELECT 1 FROM payments p JOIN jobs j ON j.id=p.job_id WHERE ${predicate} AND (p.status='authorized' OR p.refund_status IN ('pending','processing','requested') OR p.dispute_status IN ('open','needs_response','under_review') OR p.transfer_status IN ('pending','processing')) LIMIT 1`).get(key))return fail('Există plăți sau regularizări în curs. Soluționează-le înainte de ștergere.',409);
 if(table(db,'recurring_plans')&&db.prepare(`SELECT 1 FROM recurring_plans WHERE ${t.firmId?'preferred_firm_id':'client_id'}=? AND status='active' LIMIT 1`).get(key))return fail('Există planuri recurente active. Oprește sau realocă planurile înainte de ștergere.',409);
 for(const name of ['notification_outbox','push_notification_outbox'])if(table(db,name)){
  const columns=db.prepare(`PRAGMA table_info(${name})`).all() as {name:string}[];
  if(columns.some(c=>c.name==='recipient_user_id')&&db.prepare(`SELECT 1 FROM ${name} WHERE recipient_user_id=? AND status='sending' LIMIT 1`).get(t.userId))return fail('O notificare este în curs de expediere. Reîncearcă după finalizarea ei.',409);
 }
}
/** Logical account removal: keep job, evidence and financial history; never call external transports. */
export function removeAdminAccount(db:Database,value:unknown,actorId:string){
 const b=validate(value);if(!actorId)return fail('Identitate administrativă obligatorie.',403);
 return db.transaction(()=>{
  const t=target(db,b);
  if(table(db,'admin_removed_accounts')&&db.prepare('SELECT 1 FROM admin_removed_accounts WHERE user_id=? AND kind=? AND target_id=?').get(t.userId,b.kind,b.targetId))return {removed:true,replayed:true,kind:b.kind,targetId:b.targetId};
  guard(db,t);const now=new Date().toISOString();db.exec(ACCOUNT_REMOVAL_SCHEMA);
  db.prepare('INSERT INTO admin_removed_accounts VALUES(?,?,?,?,?,?,?)').run(t.userId,b.kind,b.targetId,t.name,b.reason,actorId,now);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(t.userId);
  if(t.firmId)db.prepare("UPDATE firms SET verified=0,suspended_until='9999-12-31T23:59:59.000Z' WHERE id=?").run(t.firmId);
  if(table(db,'push_devices'))db.prepare('UPDATE push_devices SET push_enabled=0,revoked_at=?,updated_at=? WHERE user_id=?').run(now,now,t.userId);
  for(const name of ['notification_outbox','push_notification_outbox'])if(table(db,name)){
   const columns=db.prepare(`PRAGMA table_info(${name})`).all() as {name:string}[];
   if(columns.some(c=>c.name==='recipient_user_id'))db.prepare(`UPDATE ${name} SET status='failed',last_error='SUPPRESSED_ACCOUNT_REMOVED' WHERE recipient_user_id=? AND status IN ('pending','failed')`).run(t.userId);
  }
  if(table(db,'availability_subscriptions'))db.prepare('UPDATE availability_subscriptions SET active=0 WHERE client_id=?').run(t.userId);
  if(table(db,'workspace_ical_connections'))db.prepare('UPDATE workspace_ical_connections SET enabled=0 WHERE owner_id=?').run(t.userId);
  if(table(db,'home_maintenance_plans'))db.prepare('UPDATE home_maintenance_plans SET active=0 WHERE client_id=?').run(t.userId);
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'account.removed',b.targetId,JSON.stringify({actorId,kind:b.kind,reason:b.reason,historyRetained:true}));
  return {removed:true,replayed:false,kind:b.kind,targetId:b.targetId};
 }).immediate();
}
