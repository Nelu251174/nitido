import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, newId } from "@/lib/db";
import { constantTimeEqual, secureToken, tokenHash } from "@/lib/security";
import {consumeAdminFactor,getAdminSecurityConfig,type AdminFactorMethod,type AdminSecurityConfig} from '@/lib/adminMfa';

const ADMIN_COOKIE = "nitido_admin_session";
const ADMIN_SESSION_HOURS = 8;

export function adminAuthConfigured(): boolean {
  return getAdminSecurityConfig()!==null;
}

async function verifyCredentials(config:AdminSecurityConfig,email:string,password:string):Promise<boolean>{
  const emailMatches=constantTimeEqual(email.trim().toLowerCase(),config.email);
  let passwordMatches=config.passwordPlain?constantTimeEqual(password,config.passwordPlain):false;
  if(!passwordMatches&&config.passwordHash)passwordMatches=await bcrypt.compare(password,config.passwordHash).catch(()=>false);
  return emailMatches&&passwordMatches;
}

/** A session can only be issued after both factors, consumed atomically with its MFA record. */
export async function authenticateAdmin(email:string,password:string,code:string,method:AdminFactorMethod):Promise<boolean>{
  const config=getAdminSecurityConfig();
  if(!config||!(await verifyCredentials(config,email,password)))return false;
  const jar=await cookies();
  if(getAdminSecurityConfig()?.binding!==config.binding)return false;
  const token=secureToken(),hashed=tokenHash(token),now=Date.now();
  const expiresAt=new Date(now+ADMIN_SESSION_HOURS*60*60*1000);
  const accepted=db.transaction(()=>{
    if(getAdminSecurityConfig()?.binding!==config.binding||!consumeAdminFactor(db,config,code,method,now))return false;
    db.prepare('DELETE FROM admin_session_mfa WHERE token_hash IN (SELECT token_hash FROM admin_sessions WHERE expires_at<=?)').run(new Date(now).toISOString());
    db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').run(new Date(now).toISOString());
    db.prepare('INSERT INTO admin_sessions(id,token_hash,expires_at) VALUES(?,?,?)').run(newId('adminsess'),hashed,expiresAt.toISOString());
    db.prepare('INSERT INTO admin_session_mfa(token_hash,auth_binding,verified_ms,method) VALUES(?,?,?,?)').run(hashed,config.binding,now,method);
    auditAdminAction('ADMIN_LOGIN_MFA',null,{method});
    return true;
  }).immediate();
  if(!accepted)return false;
  try{
    jar.set(ADMIN_COOKIE,token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',expires:expiresAt,priority:'high'});
  }catch(error){
    // The factor remains spent after an unconfirmed cookie response; do not permit its replay.
    db.transaction(()=>{db.prepare('DELETE FROM admin_session_mfa WHERE token_hash=?').run(hashed);db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hashed);})();
    throw error;
  }
  return true;
}

export async function isAdmin():Promise<boolean>{
  const jar=await cookies(),config=getAdminSecurityConfig();
  if(!config)return false;
  const token=jar.get(ADMIN_COOKIE)?.value;if(!token)return false;
  const hashed=tokenHash(token);
  const row=db.prepare(`SELECT s.expires_at,m.auth_binding,m.verified_ms,m.method FROM admin_sessions s
    LEFT JOIN admin_session_mfa m ON m.token_hash=s.token_hash WHERE s.token_hash=?`).get(hashed) as {expires_at:string;auth_binding:string|null;verified_ms:number|null;method:string|null}|undefined;
  if(!row)return false;
  const now=Date.now(),expires=Date.parse(row.expires_at);
  if(!Number.isFinite(expires)||expires<=now||row.auth_binding!==config.binding||row.verified_ms===null||row.verified_ms>now||now-row.verified_ms>=ADMIN_SESSION_HOURS*3600000||!['totp','recovery'].includes(row.method??'')){
    db.transaction(()=>{db.prepare('DELETE FROM admin_session_mfa WHERE token_hash=?').run(hashed);db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hashed);})();
    return false;
  }
  return true;
}

export async function destroyAdminSession():Promise<void>{
  const jar=await cookies(),token=jar.get(ADMIN_COOKIE)?.value;
  if(token){
    const hashed=tokenHash(token);
    db.transaction(()=>{
      db.prepare('DELETE FROM admin_session_mfa WHERE token_hash=?').run(hashed);
      if(db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hashed).changes)auditAdminAction('ADMIN_LOGOUT',null);
    })();
  }
  jar.delete(ADMIN_COOKIE);
}

export function auditAdminAction(action:string,targetId:string|null,details:object={}):void{
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(newId('audit'),action,targetId,JSON.stringify(details));
}

/** Identifies the verified administrative session in immutable operational history. */
export async function getAdminActorId():Promise<string|null>{
  if(!await isAdmin())return null;
  const token=(await cookies()).get(ADMIN_COOKIE)?.value;if(!token)return null;
  const row=db.prepare('SELECT id FROM admin_sessions WHERE token_hash=?').get(tokenHash(token)) as {id:string}|undefined;
  return row?.id??null;
}
