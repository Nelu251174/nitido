import type {Database} from 'better-sqlite3';
export {PROVIDER_INVITATIONS_SCHEMA} from './operationsSchema';
type Channel='push'|'sms';
const requiredTransaction=(db:Database)=>{if(!db.inTransaction)throw Error('INVITATION_TRANSACTION_REQUIRED');};
/** Only the authoritative new-job fan-out creates coverage. Historical outboxes are not backfilled. */
export function openInvitationCampaign(db:Database,jobId:string){requiredTransaction(db);db.prepare('INSERT OR IGNORE INTO provider_invitation_campaigns(job_id) VALUES(?)').run(jobId);}
export function trackInvitationDelivery(db:Database,channel:Channel,outboxId:string,jobId:string,userId:string|null){
 requiredTransaction(db);
 if(!userId||!db.prepare('SELECT 1 FROM provider_invitation_campaigns WHERE job_id=?').get(jobId))return;
 const firm=db.prepare('SELECT id FROM firms WHERE user_id=?').get(userId) as {id:string}|undefined;if(!firm)return;
 db.prepare('INSERT OR IGNORE INTO provider_invitations(job_id,firm_id) VALUES(?,?)').run(jobId,firm.id);
 db.prepare('INSERT OR IGNORE INTO provider_invitation_deliveries VALUES(?,?,?,?)').run(channel,outboxId,jobId,firm.id);
}
export function invitationEvent(db:Database,jobId:string,firmId:string,kind:'offered'|'withdrawn'|'accepted'|'lost',evidence:string){
 requiredTransaction(db);
 if(!db.prepare('SELECT 1 FROM provider_invitations WHERE job_id=? AND firm_id=?').get(jobId,firmId))return;
 db.prepare('INSERT OR IGNORE INTO provider_invitation_events(job_id,firm_id,kind,evidence) VALUES(?,?,?,?)').run(jobId,firmId,kind,evidence);
}
/** Persisted atomically with the notification acknowledgement, never for queued or viewed rows. */
export function acknowledgeInvitationDelivery(db:Database,channel:Channel,outboxId:string){
 requiredTransaction(db);
 db.prepare(`INSERT OR IGNORE INTO provider_invitation_events(job_id,firm_id,kind,evidence) SELECT job_id,firm_id,'sent',channel||':'||outbox_id FROM provider_invitation_deliveries WHERE channel=? AND outbox_id=?`).run(channel,outboxId);
}
export function confirmInvitationWinner(db:Database,jobId:string,firmId:string,evidence:string){
 requiredTransaction(db);invitationEvent(db,jobId,firmId,'accepted',evidence);
 const others=db.prepare('SELECT firm_id FROM provider_invitations WHERE job_id=? AND firm_id<>?').all(jobId,firmId) as {firm_id:string}[];
 for(const other of others)invitationEvent(db,jobId,other.firm_id,'lost',evidence);
}
/** Current completion of every tracked delivery is required. Unknown external outcomes stay unavailable. */
export function providerAcceptance(db:Database,jobIds:string[],firmId?:string){
 let completeJobs=0,incompleteJobs=0,untrackedJobs=0,sent=0,accepted=0,lost=0,withdrawn=0;
 for(const id of jobIds){
  if(!db.prepare('SELECT 1 FROM provider_invitation_campaigns WHERE job_id=?').get(id)){untrackedJobs++;continue;}
  const pending=db.prepare(`SELECT 1 FROM provider_invitation_deliveries d LEFT JOIN push_notification_outbox p ON d.channel='push' AND p.id=d.outbox_id LEFT JOIN notification_outbox s ON d.channel='sms' AND s.id=d.outbox_id WHERE d.job_id=? AND (COALESCE(p.status,s.status) IS NULL OR COALESCE(p.status,s.status) IN ('pending','sending') OR COALESCE(p.last_error,s.last_error)='DELIVERY_UNKNOWN' OR (COALESCE(p.status,s.status)='failed' AND COALESCE(p.attempt_count,s.attempt_count)<CASE WHEN d.channel='push' THEN 3 ELSE 5 END AND (COALESCE(p.last_error,s.last_error) IS NULL OR (COALESCE(p.last_error,s.last_error) NOT LIKE 'SUPPRESSED_%' AND COALESCE(p.last_error,s.last_error) NOT IN ('NO_ACTIVE_DEVICE','PUSH_DISABLED','PUSH_TOKEN_INVALID'))))) LIMIT 1`).get(id);
  const missingAllocationAudit=db.prepare(`SELECT 1 FROM jobs j WHERE j.id=? AND j.status<>'waiting' AND j.accepted_firm_id IS NOT NULL AND EXISTS(SELECT 1 FROM provider_invitations i WHERE i.job_id=j.id) AND NOT EXISTS(SELECT 1 FROM provider_invitation_events e WHERE e.job_id=j.id AND e.kind IN ('accepted','lost'))`).get(id);
  if(pending||missingAllocationAudit){incompleteJobs++;continue;}completeJobs++;
  const invitations=db.prepare(`SELECT i.firm_id,EXISTS(SELECT 1 FROM provider_invitation_events e WHERE e.job_id=i.job_id AND e.firm_id=i.firm_id AND kind='sent') sent,EXISTS(SELECT 1 FROM provider_invitation_events e WHERE e.job_id=i.job_id AND e.firm_id=i.firm_id AND kind='accepted') accepted,EXISTS(SELECT 1 FROM provider_invitation_events e WHERE e.job_id=i.job_id AND e.firm_id=i.firm_id AND kind='lost') lost,EXISTS(SELECT 1 FROM provider_invitation_events e WHERE e.job_id=i.job_id AND e.firm_id=i.firm_id AND kind='withdrawn') withdrawn FROM provider_invitations i WHERE i.job_id=? AND (?='' OR i.firm_id=?)`).all(id,firmId??'',firmId??'') as {sent:number;accepted:number;lost:number;withdrawn:number}[];
  for(const i of invitations){if(!i.sent)continue;sent++;accepted+=i.accepted;lost+=i.lost;withdrawn+=i.withdrawn;}
 }
 return {numerator:accepted,denominator:sent,percent:sent?accepted*100/sent:null,completeJobs,incompleteJobs,untrackedJobs,lost,withdrawn,reason:sent?null:'Date insuficiente: sunt necesare invitații trimise confirmate și cohorte cu toate livrările soluționate.',basis:'Alocări confirmate / invitații trimise cu confirmare furnizor, deduplicate pe lucrare și prestator. Numai cohorte cu toate livrările soluționate; pierderea alocării nu reprezintă refuz.'};
}
