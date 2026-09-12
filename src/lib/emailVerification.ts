import {randomBytes,createHash} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {emailConfigured,sendEmail} from './email';
export const EMAIL_VERIFICATION_SCHEMA=`CREATE TABLE IF NOT EXISTS email_verifications(user_id TEXT PRIMARY KEY REFERENCES users(id),email TEXT NOT NULL,token_hash TEXT UNIQUE,expires_at INTEGER,verified_at INTEGER);`;
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function emailIsVerified(db:Database,userId:string){return Boolean(db.prepare('SELECT 1 FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE u.id=? AND u.email=v.email AND v.verified_at IS NOT NULL').get(userId))}
export function issueEmailVerification(db:Database,userId:string,now=Date.now()){
 const u=db.prepare('SELECT email FROM users WHERE id=?').get(userId) as {email:string}|undefined;if(!u?.email)throw new Error('Email indisponibil');
 if(emailIsVerified(db,userId))throw new Error('Email deja confirmat');
 const token=randomBytes(32).toString('hex');db.prepare(`INSERT INTO email_verifications(user_id,email,token_hash,expires_at,verified_at) VALUES(?,?,?,?,NULL) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,token_hash=excluded.token_hash,expires_at=excluded.expires_at,verified_at=NULL`).run(userId,u.email,hash(token),now+24*60*60*1000);return {token,email:u.email};
}
export function confirmEmailVerification(db:Database,token:unknown,now=Date.now()){
 if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))return false;
 return db.transaction(()=>{const row=db.prepare('SELECT v.user_id FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE v.token_hash=? AND v.expires_at>? AND v.verified_at IS NULL AND u.email=v.email').get(hash(token),now) as {user_id:string}|undefined;if(!row)return false;db.prepare('UPDATE email_verifications SET verified_at=?,token_hash=NULL,expires_at=NULL WHERE user_id=?').run(now,row.user_id);return true})()
}
export async function sendVerificationEmail(db:Database,userId:string){
 if(!emailConfigured())return false;
 let base:URL;try{base=new URL(process.env.NEXT_PUBLIC_SITE_URL??'');if(base.protocol!=='https:'||base.username||base.password)return false}catch{return false}
 const {token,email}=issueEmailVerification(db,userId);
 const url=new URL('/confirma-email',base.origin);url.hash=token;
 return sendEmail({to:email,subject:'NITIDO — confirmă adresa de email',html:`<h1>Bine ai venit la NITIDO</h1><p>Confirmă adresa de email a contului tău. Linkul este valabil 24 de ore și poate fi folosit o singură dată.</p><p><a href="${url.href}">Confirmă adresa de email</a></p><p>Dacă nu ai creat acest cont, ignoră mesajul.</p>`});
}
