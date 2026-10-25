import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import type Database from 'better-sqlite3';
const mocks=vi.hoisted(()=>({db:null as Database.Database|null,verify:vi.fn()}));
vi.mock('@/lib/db',async()=>{const {default:Database}=await import('better-sqlite3');mocks.db=new Database(':memory:');return {db:mocks.db};});
vi.mock('@/lib/adminMarketingEmailVerification',async()=>{const actual=await vi.importActual<typeof import('@/lib/adminMarketingEmailVerification')>('@/lib/adminMarketingEmailVerification');return {...actual,verifyMarketingEmail:mocks.verify};});
import {POST} from './route';
import {submitMarketingSignup,prepareMarketingSignupConfirmation} from '@/lib/adminMarketingSignup';
import {MARKETING_SIGNUP_CONSENT_VERSION} from '@/lib/adminMarketingSignupShared';
let seq=0;const req=(token:string,origin='https://sandbox.nitido.ro')=>new NextRequest('https://sandbox.nitido.ro/api/marketing/confirm',{method:'POST',headers:{origin,'Content-Type':'application/json','x-forwarded-for':'confirm'+(++seq)},body:JSON.stringify({token})});
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','false');mocks.verify.mockResolvedValue(null);mocks.db!.exec('CREATE TABLE IF NOT EXISTS admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');});afterEach(()=>vi.unstubAllEnvs());
describe('public confirmation boundary',()=>{
 it('rejects untrusted origins and invalid tokens without exposing private data',async()=>{expect((await POST(req('bad','https://foreign.ro'))).status).toBe(403);const r=await POST(req('bad'));expect(r.status).toBe(400);expect((await r.json()).error).toContain('valid');});
 it('returns only confirmation status for a genuine token, never the email or contact identity',async()=>{
  submitMarketingSignup(mocks.db!,{name:'Synthetic',email:'confirmed@fixture.ro',category:'individual',county:'CT',city:'Mangalia',consent:true,consentVersion:MARKETING_SIGNUP_CONSENT_VERSION});const {id}=mocks.db!.prepare('SELECT id FROM marketing_signups').get() as {id:string};
  vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','true');const token=prepareMarketingSignupConfirmation(mocks.db!,id);vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','false');const r=await POST(req(token));expect(r.status).toBe(200);expect(await r.json()).toEqual({confirmed:true});expect(mocks.verify).toHaveBeenCalledWith(mocks.db,'confirmed@fixture.ro');
 });
});
