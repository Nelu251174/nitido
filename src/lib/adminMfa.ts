import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import type {NextRequest} from 'next/server';

export const ADMIN_MFA_SCHEMA=`
CREATE TABLE IF NOT EXISTS admin_session_mfa (
 token_hash TEXT PRIMARY KEY REFERENCES admin_sessions(token_hash) ON DELETE CASCADE,
 auth_binding TEXT NOT NULL, verified_ms INTEGER NOT NULL,
 method TEXT NOT NULL CHECK(method IN ('totp','recovery'))
);
CREATE TABLE IF NOT EXISTS admin_totp_state (secret_hash TEXT PRIMARY KEY,last_step INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_used_recovery_codes (code_hash TEXT PRIMARY KEY,used_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_login_limit (id INTEGER PRIMARY KEY CHECK(id=1),attempts INTEGER NOT NULL,reset_ms INTEGER NOT NULL);
`;
export type AdminFactorMethod='totp'|'recovery';
export type AdminSecurityConfig={email:string;passwordHash:string;passwordPlain:string;secret:Buffer;recoveryHashes:string[];binding:string};
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');

/** Canonical unpadded Base32, 160–512 bits. No secret is persisted in SQLite. */
export function decodeTotpSecret(value:string):Buffer|null{
 const text=value.toUpperCase().replace(/\s/g,'');
 if(!/^[A-Z2-7]{32,103}$/.test(text))return null;
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,acc=0;const bytes:number[]=[];
 for(const char of text){acc=(acc<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){bits-=8;bytes.push((acc>>>bits)&255);acc&=(1<<bits)-1;}}
 if(acc!==0||bytes.length<20||bytes.length>64||Math.ceil(bytes.length*8/5)!==text.length)return null;
 return Buffer.from(bytes);
}
export function getAdminSecurityConfig(env:Readonly<Record<string,string|undefined>>=process.env):AdminSecurityConfig|null{
 const email=(env.NITIDO_ADMIN_EMAIL??'').trim().toLowerCase(),passwordHash=env.NITIDO_ADMIN_PASSWORD_HASH??'',passwordPlain=env.NITIDO_ADMIN_PASSWORD??'';
 const secret=decodeTotpSecret(env.NITIDO_ADMIN_TOTP_SECRET??'');
 const raw=env.NITIDO_ADMIN_RECOVERY_HASHES??'',recoveryHashes=raw?raw.split(',').map(x=>x.trim().toLowerCase()).sort():[];
 if(!email||(!passwordHash&&!passwordPlain)||!secret||recoveryHashes.length>20||recoveryHashes.some(x=>!/^[a-f0-9]{64}$/.test(x))||new Set(recoveryHashes).size!==recoveryHashes.length)return null;
 const binding=hash(JSON.stringify([email,passwordHash,passwordPlain,secret.toString('hex'),recoveryHashes]));
 return {email,passwordHash,passwordPlain,secret,recoveryHashes,binding};
}

/** RFC 6238, HMAC-SHA1, six digits, 30 seconds. */
export function totpAt(secret:Buffer,step:number):string{
 if(!Number.isSafeInteger(step)||step<0)throw Error('INVALID_TOTP_STEP');
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
 const digest=createHmac('sha1',secret).update(counter).digest(),offset=digest[digest.length-1]&15;
 return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}

/** Called inside the same write transaction as session issuance. */
export function consumeAdminFactor(db:Database,config:AdminSecurityConfig,code:string,method:AdminFactorMethod,now:number):boolean{
 if(!db.inTransaction)throw Error('ADMIN_FACTOR_TRANSACTION_REQUIRED');
 if(method==='recovery'){
   if(!/^[a-f0-9]{32}$/i.test(code))return false;
   const codeHash=hash(code.toLowerCase());
   if(!config.recoveryHashes.includes(codeHash))return false;
   return db.prepare('INSERT OR IGNORE INTO admin_used_recovery_codes(code_hash,used_ms) VALUES(?,?)').run(codeHash,now).changes===1;
 }
 if(method!=='totp'||!/^\d{6}$/.test(code)||!Number.isSafeInteger(now)||now<0)return false;
 const current=Math.floor(now/30000),secretHash=hash(config.secret);
 let matched=-1;
 for(const step of [current-1,current,current+1]){
   if(step>=0&&timingSafeEqual(Buffer.from(totpAt(config.secret,step)),Buffer.from(code)))matched=step;
 }
 if(matched<0)return false;
 return db.prepare(`INSERT INTO admin_totp_state(secret_hash,last_step) VALUES(?,?)
   ON CONFLICT(secret_hash) DO UPDATE SET last_step=excluded.last_step WHERE last_step<excluded.last_step`).run(secretHash,matched).changes===1;
}

/** Persistent account-wide ceiling; forwarded IP changes cannot reset it. */
export function consumeAdminLoginAttempt(db:Database,now=Date.now()):boolean{
 return db.transaction(()=>{
   const row=db.prepare('SELECT attempts,reset_ms FROM admin_login_limit WHERE id=1').get() as {attempts:number;reset_ms:number}|undefined;
   if(!row||row.reset_ms<=now){db.prepare('INSERT INTO admin_login_limit(id,attempts,reset_ms) VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET attempts=1,reset_ms=excluded.reset_ms').run(now+15*60000);return true;}
   if(row.attempts>=20)return false;
   db.prepare('UPDATE admin_login_limit SET attempts=attempts+1 WHERE id=1').run();return true;
 }).immediate();
}

/** Admin cookies never accept missing/foreign origins or arbitrary Bearer overrides. */
export function hasTrustedAdminOrigin(req:NextRequest):boolean{
 const origin=req.headers.get('origin');if(!origin)return false;
 if(origin===req.nextUrl.origin)return true;
 try{const site=new URL(process.env.NEXT_PUBLIC_SITE_URL??'');return site.protocol==='https:'&&!site.username&&!site.password&&origin===site.origin;}catch{return false;}
}
