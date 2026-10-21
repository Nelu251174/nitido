import type {Database} from 'better-sqlite3';
import {createHash,randomBytes} from 'node:crypto';
import {emailIsVerified} from './emailVerification';
export class FamilyError extends Error{constructor(message:string,public status=400){super(message)}}
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function attachBeneficiary(db:Database,jobId:string,ownerId:string,value:unknown){
 if(!value||typeof value!=='object')throw new FamilyError('Completează beneficiarul și acordul său.');
 const b=value as Record<string,unknown>;
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||typeof b.email!=='string'||b.email.length>254||!/^\S+@\S+\.\S+$/.test(b.email)||b.consent!==true)throw new FamilyError('Completează numele, emailul și confirmă acordul beneficiarului.');
 const job=db.prepare('SELECT client_id FROM jobs WHERE id=?').get(jobId) as {client_id:string}|undefined;
 if(!job||job.client_id!==ownerId)throw new FamilyError('Lucrare inexistentă.',404);
 db.prepare('INSERT INTO job_beneficiaries(job_id,name,email,consent_at) VALUES(?,?,?,?)').run(jobId,b.name.trim(),b.email.trim().toLowerCase(),new Date().toISOString());
}
export function hasBeneficiary(db:Database,jobId:string){return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='job_beneficiaries'").get()&&db.prepare('SELECT 1 FROM job_beneficiaries WHERE job_id=?').get(jobId));}
export function ownedBeneficiary(db:Database,jobId:string,ownerId:string){
 const row=db.prepare('SELECT b.name,b.email,b.revoked,b.accepted_by FROM job_beneficiaries b JOIN jobs j ON j.id=b.job_id WHERE j.id=? AND j.client_id=?').get(jobId,ownerId) as {name:string;email:string;revoked:number;accepted_by:string|null}|undefined;
 if(!row)throw new FamilyError('Beneficiar indisponibil pentru acest cont.',404);return row;
}
export function inviteBeneficiary(db:Database,jobId:string,ownerId:string){
 return db.transaction(()=>{ownedBeneficiary(db,jobId,ownerId);const token=randomBytes(32).toString('base64url');db.prepare('UPDATE job_beneficiaries SET token_hash=?,expires_at=?,accepted_by=NULL,revoked=0 WHERE job_id=?').run(hash(token),new Date(Date.now()+7*86400000).toISOString(),jobId);return token;}).immediate();
}
export function revokeBeneficiary(db:Database,jobId:string,ownerId:string){ownedBeneficiary(db,jobId,ownerId);db.prepare('UPDATE job_beneficiaries SET revoked=1,token_hash=NULL,accepted_by=NULL WHERE job_id=?').run(jobId);}
export function acceptBeneficiary(db:Database,userId:string,token:unknown){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new FamilyError('Invitație invalidă.',404);
 return db.transaction(()=>{
  const row=db.prepare('SELECT b.*,j.client_id FROM job_beneficiaries b JOIN jobs j ON j.id=b.job_id WHERE b.token_hash=? AND b.revoked=0 AND b.expires_at>?').get(hash(token),new Date().toISOString()) as {job_id:string;email:string;accepted_by:string|null;client_id:string}|undefined;
  const user=db.prepare("SELECT email FROM users WHERE id=? AND role='client'").get(userId) as {email:string|null}|undefined;
  if(!row||!user)throw new FamilyError('Invitația a expirat sau a fost retrasă.',404);
  if(row.client_id===userId)throw new FamilyError('Acesta este contul plătitorului. Beneficiarul folosește propriul cont.',409);
  if(user.email?.trim().toLowerCase()!==row.email)throw new FamilyError('Intră în contul cu emailul pentru care a fost creată invitația.',403);
  if(!emailIsVerified(db,userId))throw new FamilyError('Confirmă adresa de email a contului înainte de a accepta invitația.',403);
  if(row.accepted_by&&row.accepted_by!==userId)throw new FamilyError('Invitația este deja utilizată.',409);
  db.prepare('UPDATE job_beneficiaries SET accepted_by=? WHERE job_id=?').run(userId,row.job_id);return row.job_id;
 }).immediate();
}
/** A dedicated read projection; never extends access to payment, photos, cancellation or ratings APIs. */
export function beneficiaryVisits(db:Database,userId:string){return db.prepare(`SELECT j.id,j.city,j.status,j.scheduled_at,j.duration_minutes,j.space_type,u.name firm_name
 FROM job_beneficiaries b JOIN jobs j ON j.id=b.job_id LEFT JOIN firms f ON f.id=j.accepted_firm_id LEFT JOIN users u ON u.id=f.user_id
 JOIN users recipient ON recipient.id=b.accepted_by
 WHERE b.accepted_by=? AND b.revoked=0 AND LOWER(recipient.email)=b.email
 AND EXISTS(SELECT 1 FROM email_verifications v WHERE v.user_id=recipient.id AND v.email=recipient.email AND v.verified_at IS NOT NULL)
 ORDER BY j.created_at DESC`).all(userId) as {id:string;city:string;status:string;scheduled_at:string|null;duration_minutes:number;space_type:string;firm_name:string|null}[];}
