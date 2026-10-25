import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import type Database from 'better-sqlite3';
const mocks=vi.hoisted(()=>({actor:vi.fn(),db:null as Database.Database|null}));
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:mocks.actor}));
vi.mock('@/lib/db',async()=>{const {default:Database}=await import('better-sqlite3');mocks.db=new Database(':memory:');return {db:mocks.db};});
import {GET,POST} from './route';
const request=(body?:unknown,origin='https://sandbox.nitido.ro')=>new NextRequest('https://sandbox.nitido.ro/api/admin/marketing/signups',{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.clearAllMocks();mocks.actor.mockResolvedValue(null);});afterEach(()=>vi.unstubAllEnvs());
describe('Marketing signup ADMIN boundary',()=>{
 it('protects all personal lead data with the existing super_admin access check',async()=>{expect((await GET(request())).status).toBe(401);expect((await POST(request({action:'withdraw'}))).status).toBe(401);expect(mocks.actor).toHaveBeenCalledWith('super_admin');expect(mocks.db!.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_signups'").get()).toBeUndefined();});
 it('rejects cross-origin mutation and exposes no confirmation secrets to an authorized administrator',async()=>{
  mocks.actor.mockResolvedValue('owner');expect((await POST(request({action:'withdraw'},'https://foreign.ro'))).status).toBe(403);const r=await GET(request());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({items:[],counts:{pending:0,confirmed:0,withdrawn:0}});
 });
});
