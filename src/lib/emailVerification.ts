import {randomBytes,createHash,randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {emailConfigured,emailSenderValid,emailFailure,sendEmailResult,type EmailResult} from './email';
import {recordEmailDiagnostic} from './emailDeliveryDiagnostics';
import {activeAccountSql} from './accountStatus';
export const EMAIL_VERIFICATION_SCHEMA=`
CREATE TABLE IF NOT EXISTS email_verifications(user_id TEXT PRIMARY KEY REFERENCES users(id),email TEXT NOT NULL,token_hash TEXT UNIQUE,expires_at INTEGER,verified_at INTEGER);
CREATE TABLE IF NOT EXISTS email_verification_send_leases(
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 lease_id TEXT NOT NULL,expires_at INTEGER NOT NULL
);`;
/** More than the shared eight-second provider deadline; a crashed sender cannot block forever. */
export const EMAIL_VERIFICATION_SEND_LEASE_MS=30000;
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function emailIsVerified(db:Database,userId:string){return Boolean(db.prepare(`SELECT 1 FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE u.id=? AND u.email=v.email AND v.verified_at IS NOT NULL AND ${activeAccountSql(db,'u.id')}`).get(userId))}
export function issueEmailVerification(db:Database,userId:string,now=Date.now()){
 const u=db.prepare(`SELECT u.email FROM users u WHERE u.id=? AND ${activeAccountSql(db,'u.id')}`).get(userId) as {email:string}|undefined;if(!u?.email)throw new Error('Email indisponibil');
 if(emailIsVerified(db,userId))throw new Error('Email deja confirmat');
 const token=randomBytes(32).toString('hex');db.prepare(`INSERT INTO email_verifications(user_id,email,token_hash,expires_at,verified_at) VALUES(?,?,?,?,NULL) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,token_hash=excluded.token_hash,expires_at=excluded.expires_at,verified_at=NULL`).run(userId,u.email,hash(token),now+24*60*60*1000);return {token,email:u.email};
}
export function confirmEmailVerification(db:Database,token:unknown,now=Date.now()){
 if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))return false;
 return db.transaction(()=>{const row=db.prepare(`SELECT v.user_id FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE v.token_hash=? AND v.expires_at>? AND v.verified_at IS NULL AND u.email=v.email AND ${activeAccountSql(db,'u.id')}`).get(hash(token),now) as {user_id:string}|undefined;if(!row)return false;db.prepare('UPDATE email_verifications SET verified_at=?,token_hash=NULL,expires_at=NULL WHERE user_id=?').run(now,row.user_id);return true})()
}
export async function sendVerificationEmailResult(db:Database,userId:string):Promise<EmailResult>{
 const correlationId=randomUUID();
 const finish=(result:EmailResult)=>{
   const stored=recordEmailDiagnostic(db,userId,result);
   console.info('email_verification_result',{...result,diagnosticStored:stored});
   return result;
 };
 if(!emailConfigured())return finish(emailFailure('not_configured','configuration',correlationId));
 if(!emailSenderValid())return finish(emailFailure('invalid_sender','configuration',correlationId));
 let base:URL;try{base=new URL(process.env.NEXT_PUBLIC_SITE_URL??'');if(base.protocol!=='https:'||base.username||base.password)return finish(emailFailure('invalid_site','site',correlationId))}catch{return finish(emailFailure('invalid_site','site',correlationId))}
 type Previous={email:string;token_hash:string|null;expires_at:number|null;verified_at:number|null};
 let prepared:{leaseId:string;previous:Previous|undefined;issued:{token:string;email:string}}|null;
 try{
   // Claim and issue together. Never hold a writer transaction during provider I/O.
   prepared=db.transaction(()=>{
     const now=Date.now(),leaseId=randomUUID();
     const claimed=db.prepare(`INSERT INTO email_verification_send_leases(user_id,lease_id,expires_at) VALUES(?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET lease_id=excluded.lease_id,expires_at=excluded.expires_at
       WHERE email_verification_send_leases.expires_at<=?`).run(userId,leaseId,now+EMAIL_VERIFICATION_SEND_LEASE_MS,now);
     if(claimed.changes!==1)return null;
     const previous=db.prepare('SELECT email,token_hash,expires_at,verified_at FROM email_verifications WHERE user_id=?').get(userId) as Previous|undefined;
     return {leaseId,previous,issued:issueEmailVerification(db,userId,now)};
   }).immediate();
 }catch{return finish(emailFailure('token_issue_failed','verification',correlationId))}
 if(!prepared)return finish(emailFailure('verification_busy','verification',correlationId));
 const {leaseId,previous,issued:{token,email}}=prepared;
 try{
   const url=new URL('/confirma-email',base.origin);url.hash=token;
   const result=await sendEmailResult({to:email,subject:'NITIDO — confirmă adresa de email',html:`<h1>Bine ai venit la NITIDO</h1><p>Confirmă adresa de email a contului tău. Linkul este valabil 24 de ore și poate fi folosit o singură dată.</p><p><a href="${url.href}">Confirmă adresa de email</a></p><p>Dacă nu ai creat acest cont, ignoră mesajul.</p>`,idempotencyKey:`verify-email/${hash(token)}`},{correlationId,retryTransient:true});
   if(!result.accepted){
     // Restore only the leased attempt, never a newer attempt, confirmation or changed address.
     try{db.transaction(()=>{
       const lease=db.prepare('SELECT lease_id FROM email_verification_send_leases WHERE user_id=?').get(userId) as {lease_id:string}|undefined;
       if(lease?.lease_id!==leaseId)return;
       const current=db.prepare('SELECT token_hash,verified_at FROM email_verifications WHERE user_id=?').get(userId) as {token_hash:string|null;verified_at:number|null}|undefined;
       if(!current||current.token_hash!==hash(token)||current.verified_at!==null)return;
       const sameAccount=db.prepare(`SELECT 1 FROM users u WHERE u.id=? AND u.email=? AND ${activeAccountSql(db,'u.id')}`).get(userId,email);
       if(previous&&previous.email===email&&sameAccount){
         db.prepare('UPDATE email_verifications SET email=?,token_hash=?,expires_at=?,verified_at=? WHERE user_id=?').run(previous.email,previous.token_hash,previous.expires_at,previous.verified_at,userId);
       }else db.prepare('DELETE FROM email_verifications WHERE user_id=?').run(userId);
     }).immediate()}catch{/* Never expose database exception text or overwrite a later account state. */}
   }
   return finish(result);
 }finally{
   try{db.prepare('DELETE FROM email_verification_send_leases WHERE user_id=? AND lease_id=?').run(userId,leaseId)}catch{/* A crashed or interrupted send expires after the bounded lease. */}
 }
}
export async function sendVerificationEmail(db:Database,userId:string):Promise<boolean>{
 return (await sendVerificationEmailResult(db,userId)).accepted;
}
