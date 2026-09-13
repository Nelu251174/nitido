import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({cookies:new Map<string,string>(),user:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(name:string)=>state.cookies.has(name)?{value:state.cookies.get(name)}:undefined,set:(name:string,value:string)=>state.cookies.set(name,value),delete:(name:string)=>state.cookies.delete(name)})}));
vi.mock('@/lib/auth',()=>({getCurrentUser:state.user}));
vi.mock('@/lib/db',async original=>{
 const actual=await original<typeof import('@/lib/db')>();
 const {default:Sqlite}=await import('better-sqlite3');
 const db=new Sqlite(':memory:');db.exec(actual.SCHEMA_SQL);
 return {...actual,db};
});
import {db} from '@/lib/db';
import {authenticateAdmin,destroyAdminSession} from '@/lib/adminAuth';
import {getAdminSecurityConfig,totpAt} from '@/lib/adminMfa';
import {GET} from './route';
import {GET as accountGET} from '../api/auth/account/route';
const request=()=>new NextRequest('https://sandbox.nitido.ro/cont');
const destination=async()=>{
 const res=await GET(request());
 expect(res.status).toBe(307);
 expect(res.headers.get('cache-control')).toBe('private, no-store');
 expect(res.headers.get('vary')).toBe('Cookie');
 const path=new URL(res.headers.get('location')!).pathname;
 const accountResponse=await accountGET();
 expect(accountResponse.headers.get('cache-control')).toBe('private, no-store');
 expect(accountResponse.headers.get('vary')).toBe('Cookie');
 const account=await accountResponse.json();
 expect(account.destination).toBe(path);
 expect(account.label).toBe(path==='/admin'?'Panou ADMIN':path==='/login'?null:'Contul meu');
 expect(account.role).toBe(path==='/admin'?'admin':path==='/firma'?'firma':path==='/client'?'client':null);
 return path;
};
async function loginAdmin(){
 const config=getAdminSecurityConfig()!;
 expect(await authenticateAdmin('admin@example.com','test-password',totpAt(config.secret,Math.floor(Date.now()/30000)),'totp')).toBe(true);
}
beforeEach(()=>{
 vi.clearAllMocks();state.cookies.clear();state.user.mockResolvedValue(null);
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-13T07:00:00Z'));
 vi.stubEnv('NITIDO_ADMIN_EMAIL','admin@example.com');vi.stubEnv('NITIDO_ADMIN_PASSWORD','test-password');vi.stubEnv('NITIDO_ADMIN_PASSWORD_HASH','');vi.stubEnv('NITIDO_ADMIN_TOTP_SECRET','GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');vi.stubEnv('NITIDO_ADMIN_RECOVERY_HASHES','');
 db.exec('DELETE FROM admin_session_mfa;DELETE FROM admin_sessions;DELETE FROM admin_totp_state;DELETE FROM admin_used_recovery_codes;DELETE FROM admin_audit_log');
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
describe('HOME → Contul meu resolves the authenticated account on every click',()=>{
 it.each(['firma','client'])('keeps ADMIN when a %s session also exists',async role=>{
   state.user.mockResolvedValue({role});await loginAdmin();
   expect(await destination()).toBe('/admin');expect(state.user).not.toHaveBeenCalled();
 });
 it('recognizes ADMIN without any client or partner account',async()=>{await loginAdmin();expect(await destination()).toBe('/admin');});
 it.each([['firma','/firma'],['client','/client'],[null,'/login']])('routes non-admin %s correctly',async(role,path)=>{
   state.user.mockResolvedValue(role?{role}:null);expect(await destination()).toBe(path);
 });
 it('reevaluates the destination after admin login and logout in another tab',async()=>{
   state.user.mockResolvedValue({role:'firma'});
   expect(await destination()).toBe('/firma');await loginAdmin();expect(await destination()).toBe('/admin');
   await destroyAdminSession();expect(await destination()).toBe('/firma');
 });
 it('does not treat an expired admin session as valid',async()=>{
   state.user.mockResolvedValue({role:'firma'});await loginAdmin();vi.advanceTimersByTime(8*3600*1000);
   expect(await destination()).toBe('/firma');
 });
 it('rejects an admin cookie with its MFA binding removed',async()=>{
   await loginAdmin();db.exec('DELETE FROM admin_session_mfa');expect(await destination()).toBe('/login');
 });
 it('ignores supplied role and next parameters',async()=>{
   const res=await GET(new NextRequest('https://sandbox.nitido.ro/cont?role=admin&next=https://other.example'));
   expect(res.headers.get('location')).toBe('https://sandbox.nitido.ro/login');
 });
});
