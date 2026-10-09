import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
export class AccountDeletionError extends Error { constructor(message: string, public status = 400) { super(message); } }
export type DeletionRequest = { id: string; status: 'requested' | 'under_review'; createdAt: string; updatedAt: string; revision: number };
export const DELETION_REQUEST_MESSAGE = 'Cererea de ștergere a contului este înregistrată pentru procesare. Contul și datele nu sunt încă șterse.';
const selection = `SELECT r.id,r.created_at AS createdAt,e.created_at AS updatedAt,e.status,e.revision FROM account_deletion_requests r JOIN account_deletion_events e ON e.request_id=r.id AND e.revision=(SELECT MAX(revision) FROM account_deletion_events WHERE request_id=r.id)`;
export function getDeletionRequest(db: Database, userId: string): DeletionRequest | null { return db.prepare(selection + ' WHERE r.user_id=?').get(userId) as DeletionRequest | undefined ?? null; }
function audit(db: Database, action: string, id: string, actorId: string, actorType: 'user' | 'admin', details: object) { db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,id,JSON.stringify({actorId,actorType,...details})); }
export function requestAccountDeletion(db: Database, userId: string) {
 return db.transaction(() => {
  if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(userId)) throw new AccountDeletionError('Cont inexistent.',404);
  const previous=getDeletionRequest(db,userId); if(previous) return {request:previous,replayed:true};
  const id=randomUUID(),now=new Date().toISOString();
  db.prepare('INSERT INTO account_deletion_requests VALUES(?,?,?)').run(id,userId,now);
  db.prepare('INSERT INTO account_deletion_events VALUES(?,1,?,?,?,?,?)').run(id,'requested',userId,'user','Confirmare explicită a titularului contului.',now);
  audit(db,'account.deletion_requested',id,userId,'user',{revision:1});
  return {request:getDeletionRequest(db,userId)!,replayed:false};
 }).immediate();
}
export function deletionQueue(db: Database, offset: number) {
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000) throw new AccountDeletionError('Pagină invalidă.');
 return db.transaction(()=>{const total=(db.prepare('SELECT COUNT(*) n FROM account_deletion_requests').get() as {n:number}).n;
 const requests=db.prepare(selection.replace(' FROM account_deletion_requests',',u.name,u.email,u.role,r.user_id AS userId FROM account_deletion_requests')+' JOIN users u ON u.id=r.user_id ORDER BY r.created_at,r.id LIMIT 50 OFFSET ?').all(offset) as (DeletionRequest & {userId:string;name:string;email:string|null;role:string})[];
 return {requests,total,offset,hasMore:offset+requests.length<total};})();
}
export function reviewDeletionRequest(db: Database, value: unknown, actorId: string) {
 if(!value||typeof value!=='object'||Array.isArray(value)) throw new AccountDeletionError('Date invalide.');
 const b=value as Record<string,unknown>;
 if(typeof b.id!=='string'||b.id.length>100||!Number.isSafeInteger(b.revision)||Number(b.revision)<1||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000) throw new AccountDeletionError('Cerere, versiune și motiv obligatorii.');
 const id=b.id;
 return db.transaction(()=>{const request=db.prepare(selection+' WHERE r.id=?').get(b.id) as DeletionRequest|undefined;
  if(!request) throw new AccountDeletionError('Cerere inexistentă.',404);
  const last=db.prepare('SELECT actor_id,reason FROM account_deletion_events WHERE request_id=? AND revision=?').get(b.id,request.revision) as {actor_id:string;reason:string};
  if(request.status==='under_review'&&request.revision===Number(b.revision)+1&&last.actor_id===actorId&&last.reason===b.reason) return {request,replayed:true};
  if(request.status!=='requested'||request.revision!==b.revision) throw new AccountDeletionError('Cererea a fost deja preluată. Reîncarcă lista.',409);
  const revision=request.revision+1,now=new Date().toISOString();
  db.prepare('INSERT INTO account_deletion_events VALUES(?,?,?,?,?,?,?)').run(b.id,revision,'under_review',actorId,'admin',b.reason,now);
  audit(db,'account.deletion_review_started',id,actorId,'admin',{revision,reason:b.reason});
  return {request:db.prepare(selection+' WHERE r.id=?').get(b.id) as DeletionRequest,replayed:false};
 }).immediate();
}
