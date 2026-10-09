import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';
const state=vi.hoisted(()=>({values:new Map<string,string>(),set:vi.fn(),remove:vi.fn(),beforeCookies:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>{await state.beforeCookies();return {get:(name:string)=>state.values.has(name)?{name,value:state.values.get(name)}:undefined,set:state.set,delete:state.remove};}}));
vi.mock('@/lib/db',async original=>{const actual=await original<typeof import('@/lib/db')>();const {default:Sqlite}=await import('better-sqlite3');const db=new Sqlite(':memory:');db.exec(actual.SCHEMA_SQL);return {...actual,db};});
import {db} from '@/lib/db';
import {POST} from './route';
import {POST as logout} from '../logout/route';
import {POST as cancellation} from '../../payment-cancellation/route';
import {isAdmin,authenticateAdmin} from '@/lib/adminAuth';
import {getAdminSecurityConfig,totpAt} from '@/lib/adminMfa';
import {tokenHash} from '@/lib/security';

let sequence=0;
const recovery='1234567890abcdef1234567890abcdef';
const body=()=>({email:'admin@example.com',password:'fixture-password',code:totpAt(getAdminSecurityConfig()!.secret,Math.floor(Date.now()/30000)),method:'totp'});
const request=(data:unknown=body(),origin='https://nitido.test')=>new NextRequest('https://nitido.test/api/admin/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/json','x-forwarded-for':`192.0.2.${++sequence}`,authorization:'Bearer untrusted'},body:typeof data==='string'?data:JSON.stringify(data)});
beforeEach(()=>{
 vi.resetAllMocks();state.values.clear();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-13T07:00:00Z'));
 vi.stubEnv('NITIDO_ADMIN_EMAIL','admin@example.com');vi.stubEnv('NITIDO_ADMIN_PASSWORD','fixture-password');vi.stubEnv('NITIDO_ADMIN_PASSWORD_HASH','');vi.stubEnv('NITIDO_ADMIN_TOTP_SECRET','GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');vi.stubEnv('NITIDO_ADMIN_RECOVERY_HASHES',createHash('sha256').update(recovery).digest('hex'));vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_ENABLE_BEARER_AUTH','true');
 db.exec('DROP TRIGGER IF EXISTS reject_mfa;DELETE FROM admin_session_identity;DELETE FROM admin_session_mfa;DELETE FROM admin_sessions;DELETE FROM admin_totp_state;DELETE FROM admin_used_recovery_codes;DELETE FROM admin_login_limit;DELETE FROM admin_audit_log');
 state.set.mockImplementation((name:string,value:string)=>state.values.set(name,value));state.remove.mockImplementation((name:string)=>state.values.delete(name));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
describe('admin password plus MFA and protected session',()=>{
 it('requires both factors and creates a protected cookie with only a hash stored',async()=>{
   const response=await POST(request());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.json()).toEqual({ok:true});expect(await isAdmin()).toBe(true);
   const token=state.values.get('nitido_admin_session')!;expect(db.prepare('SELECT token_hash FROM admin_sessions').get()).toEqual({token_hash:tokenHash(token)});expect(state.set).toHaveBeenCalledWith('nitido_admin_session',token,expect.objectContaining({httpOnly:true,sameSite:'strict',path:'/'}));
   const audit=JSON.stringify(db.prepare('SELECT * FROM admin_audit_log').all());expect(audit).toContain('ADMIN_LOGIN_MFA');expect(audit).not.toContain(body().password);expect(audit).not.toContain(body().code);expect(audit).not.toContain(process.env.NITIDO_ADMIN_TOTP_SECRET!);
 });
 it('sets Secure for production cookies',async()=>{vi.stubEnv('NODE_ENV','production');expect((await POST(request())).status).toBe(200);expect(state.set.mock.calls[0][2].secure).toBe(true);});
 it.each([{password:'wrong'},{email:'other@example.com'},{code:'000000'}])('rejects invalid credentials %j without issuing a session',async patch=>{const response=await POST(request({...body(),...patch}));expect(response.status).toBe(401);expect(await response.json()).toEqual({error:'Emailul, parola sau codul nu sunt valide.'});expect(state.set).not.toHaveBeenCalled();expect(await isAdmin()).toBe(false);});
 it('does not burn a correct code when the password is wrong',async()=>{await POST(request({...body(),password:'wrong'}));expect((await POST(request())).status).toBe(200);});
 it('accepts the existing bcrypt credential path',async()=>{vi.useRealTimers();vi.stubEnv('NITIDO_ADMIN_PASSWORD_HASH',await bcrypt.hash('fixture-password',10));vi.stubEnv('NITIDO_ADMIN_PASSWORD','');expect((await POST(request())).status).toBe(200);});
 it.each(['','https://foreign.test'])('rejects a missing/foreign origin despite Bearer header',async origin=>{expect((await POST(request(body(),origin))).status).toBe(403);expect(state.set).not.toHaveBeenCalled();});
 it('accepts the configured HTTPS proxy origin',async()=>{expect((await POST(request(body(),'https://sandbox.nitido.ro'))).status).toBe(200);});
 it('fails closed when MFA is missing even with a valid password',async()=>{const data=body();vi.stubEnv('NITIDO_ADMIN_TOTP_SECRET','');expect((await POST(request(data))).status).toBe(503);expect(state.set).not.toHaveBeenCalled();});
 it.each([null,{},'invalid JSON',{email:1},' '.repeat(4097)])('rejects invalid bodies',async value=>{expect((await POST(request(value))).status).toBe(400);});
 it('allows only one concurrent login with the same OTP',async()=>{const data=body();const results=await Promise.all([POST(request(data)),POST(request(data))]);expect(results.map(x=>x.status).sort()).toEqual([200,401]);expect(db.prepare('SELECT * FROM admin_sessions').all()).toHaveLength(1);});
 it('recovers with password plus a one-use recovery code',async()=>{const data={...body(),code:recovery,method:'recovery'};expect((await POST(request(data))).status).toBe(200);expect(await isAdmin()).toBe(true);expect((await POST(request(data))).status).toBe(401);expect(db.prepare('SELECT method FROM admin_session_mfa').get()).toEqual({method:'recovery'});});
 it('rejects legacy password-only sessions at a financial endpoint',async()=>{const token='legacy-session-token';db.prepare('INSERT INTO admin_sessions(id,token_hash,expires_at) VALUES(?,?,?)').run('legacy',tokenHash(token),new Date(Date.now()+60000).toISOString());state.values.set('nitido_admin_session',token);expect((await cancellation(new NextRequest('https://nitido.test/api/admin/payment-cancellation',{method:'POST',headers:{origin:'https://nitido.test'},body:'{}'}))).status).toBe(401);});
 it('allows an MFA session to reach financial request validation',async()=>{await POST(request());expect((await cancellation(new NextRequest('https://nitido.test/api/admin/payment-cancellation',{method:'POST',headers:{origin:'https://nitido.test'},body:'{}'}))).status).toBe(400);});
 it.each([['NITIDO_ADMIN_PASSWORD','rotated'],['NITIDO_ADMIN_EMAIL','other@example.com'],['NITIDO_ADMIN_TOTP_SECRET','JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'],['NITIDO_ADMIN_RECOVERY_HASHES','']])('revokes sessions after changing %s',async(name,value)=>{await POST(request());vi.stubEnv(name,value);expect(await isAdmin()).toBe(false);expect(db.prepare('SELECT * FROM admin_sessions').all()).toHaveLength(0);});
 it('expires sessions and revokes them on logout',async()=>{await POST(request());expect((await logout(request())).status).toBe(200);expect(await isAdmin()).toBe(false);expect(db.prepare('SELECT * FROM admin_session_mfa').all()).toHaveLength(0);vi.setSystemTime(Date.now()+30000);await POST(request());vi.setSystemTime(Date.now()+8*3600000);expect(await isAdmin()).toBe(false);});
 it('rejects foreign-origin logout without destroying the session',async()=>{await POST(request());expect((await logout(request(body(),'https://foreign.test'))).status).toBe(403);expect(await isAdmin()).toBe(true);});
 it('rolls back OTP consumption if persisting the session factor fails',async()=>{db.exec("CREATE TRIGGER reject_mfa BEFORE INSERT ON admin_session_mfa BEGIN SELECT RAISE(ABORT,'fixture'); END");expect((await POST(request())).status).toBe(503);expect(db.prepare('SELECT * FROM admin_totp_state').all()).toHaveLength(0);expect(db.prepare('SELECT * FROM admin_sessions').all()).toHaveLength(0);db.exec('DROP TRIGGER reject_mfa');expect((await POST(request())).status).toBe(200);});
 it('rejects credential changes while login is awaiting the cookie context',async()=>{state.beforeCookies.mockImplementationOnce(()=>{vi.stubEnv('NITIDO_ADMIN_PASSWORD','rotated');});const data=body();expect(await authenticateAdmin(data.email,data.password,data.code,'totp')).toBe(false);expect(state.set).not.toHaveBeenCalled();});
 it('does not keep an orphan session if cookie issuance fails',async()=>{state.set.mockImplementationOnce(()=>{throw Error('private cookie error');});const response=await POST(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('private cookie error');expect(db.prepare('SELECT * FROM admin_sessions').all()).toHaveLength(0);expect((await POST(request())).status).toBe(401);});
 it('enforces the account-wide attempt limit despite changing forwarded IPs',async()=>{for(let i=0;i<20;i++)expect((await POST(request({...body(),password:'wrong'}))).status).toBe(401);expect((await POST(request())).status).toBe(429);vi.setSystemTime(Date.now()+15*60000);expect((await POST(request())).status).toBe(200);});
});

describe('nominal internal roles with real MFA sessions',()=>{
 async function staff(role:'operator'|'manager'|'finance'){
  vi.useRealTimers();const email=`staff${++sequence}@example.com`,secret='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  vi.stubEnv('NITIDO_ADMIN_STAFF_ACCOUNTS_JSON',JSON.stringify([{email,passwordHash:await bcrypt.hash('staff-password',10),totpSecret:secret}]));
  db.prepare('INSERT INTO admin_staff VALUES(?,?,?,?,?)').run(email,email,role,1,1);
  const config=getAdminSecurityConfig({NITIDO_ADMIN_EMAIL:email,NITIDO_ADMIN_PASSWORD:'staff-password',NITIDO_ADMIN_TOTP_SECRET:secret})!;
  expect((await POST(request({email,password:'staff-password',code:totpAt(config.secret,Math.floor(Date.now()/30000)),method:'totp'}))).status).toBe(200);return email;
 }
 it('prevents an Operator from reaching financial or Super Admin endpoints',async()=>{await staff('operator');expect(await isAdmin('operations')).toBe(true);expect(await isAdmin('finance')).toBe(false);expect(await isAdmin()).toBe(false);expect((await cancellation(new NextRequest('https://nitido.test/api/admin/payment-cancellation',{method:'POST',headers:{origin:'https://nitido.test'},body:'{}'}))).status).toBe(401);});
 it('gives Finance financial access without operational or role-management access',async()=>{await staff('finance');expect(await isAdmin('finance')).toBe(true);expect(await isAdmin('operations')).toBe(false);expect(await isAdmin()).toBe(false);});
 it('invalidates existing sessions immediately on role revision or deactivation',async()=>{const id=await staff('manager');expect(await isAdmin('manage')).toBe(true);db.prepare('UPDATE admin_staff SET revision=revision+1,role=? WHERE id=?').run('super_admin',id);expect(await isAdmin()).toBe(false);expect(await isAdmin('session')).toBe(false);});
 it('revokes staff access if the credential registry is removed',async()=>{await staff('manager');vi.stubEnv('NITIDO_ADMIN_STAFF_ACCOUNTS_JSON','[]');expect(await isAdmin('session')).toBe(false);});
});
