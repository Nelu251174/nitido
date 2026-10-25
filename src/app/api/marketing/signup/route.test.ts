import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import type Database from 'better-sqlite3';
const mocks=vi.hoisted(()=>({db:null as Database.Database|null}));
vi.mock('@/lib/db',async()=>{const {default:Database}=await import('better-sqlite3');mocks.db=new Database(':memory:');return {db:mocks.db};});
import {POST} from './route';
import {MARKETING_SIGNUP_CONSENT_VERSION} from '@/lib/adminMarketingSignupShared';
let seq=0;
function req(body:unknown,origin='https://sandbox.nitido.ro',ip=String(++seq)){return new NextRequest('https://sandbox.nitido.ro/api/marketing/signup',{method:'POST',headers:{origin,'Content-Type':'application/json','x-forwarded-for':ip},body:JSON.stringify(body)});}
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','false');mocks.db!.exec('CREATE TABLE IF NOT EXISTS admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');});
afterEach(()=>vi.unstubAllEnvs());
describe('public Marketing signup boundary',()=>{
 it('rejects foreign origins and oversized requests before creating a lead',async()=>{expect((await POST(req({},'https://foreign.ro'))).status).toBe(403);expect((await POST(req({name:'x'.repeat(5000)}))).status).toBe(413);});
 it('accepts explicit consent without sending, exposing an ID or confirming the address',async()=>{
  const b={name:'Synthetic',email:'public@fixture.ro',category:'individual',county:'B',city:'București',consent:true,consentVersion:MARKETING_SIGNUP_CONSENT_VERSION};const first=await POST(req(b));expect(first.status).toBe(202);expect(await first.json()).toEqual({received:true});expect(await (await POST(req(b))).json()).toEqual({received:true});
  expect(mocks.db!.prepare('SELECT state,confirmation_hash FROM marketing_signups').get()).toEqual({state:'pending',confirmation_hash:null});expect(mocks.db!.prepare('SELECT COUNT(*) n FROM marketing_contacts').get()).toEqual({n:0});
 });
 it('rate-limits repeated submissions from the same source',async()=>{const ip='limit-fixture';for(let i=0;i<6;i++)await POST(req({},undefined,ip));expect((await POST(req({},undefined,ip))).status).toBe(429);});
});
