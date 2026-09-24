import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {MANAGED_PRICING_SCHEMA} from '@/lib/managedPricingStore';
const state=vi.hoisted(()=>({db:null as unknown as Database.Database,isAdmin:vi.fn(),origin:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/db',()=>({get db(){return state.db;}}));
vi.mock('@/lib/adminAuth',()=>({isAdmin:state.isAdmin,auditAdminAction:state.audit}));
vi.mock('@/lib/security',()=>({hasTrustedMutationOrigin:state.origin}));
import {GET,POST} from './route';
const request=(body:unknown)=>new Request('https://sandbox.nitido.ro/api/admin/pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}) as never;
beforeEach(()=>{vi.resetAllMocks();state.db=new Database(':memory:');state.db.exec(MANAGED_PRICING_SCHEMA);state.isAdmin.mockResolvedValue(true);state.origin.mockReturnValue(true);});
afterEach(()=>state.db.close());
describe('pricing admin route',()=>{
  it('requires admin authentication for reads and mutations',async()=>{state.isAdmin.mockResolvedValue(false);expect((await GET()).status).toBe(401);expect((await POST(request({action:'create',label:'Test'}))).status).toBe(401);expect(state.audit).not.toHaveBeenCalled();});
  it('blocks cross-origin writes',async()=>{state.origin.mockReturnValue(false);expect((await POST(request({action:'create',label:'Test'}))).status).toBe(403);expect(state.audit).not.toHaveBeenCalled();});
  it('rejects malformed bodies and unknown actions',async()=>{expect((await POST(request(null))).status).toBe(400);expect((await POST(request({action:'delete'}))).status).toBe(400);});
  it('creates, reads and simulates a version without enabling booking prices',async()=>{
    const response=await POST(request({action:'create',label:'Paritate'}));expect(response.status).toBe(200);
    const created=await response.json();expect(created.bookingActivation).toBe(false);
    const sim=await POST(request({action:'simulate',id:created.result.id,revision:0}));expect(sim.status).toBe(200);
    expect((await sim.json()).result.results.every((r:{deltaBani:number})=>r.deltaBani===0)).toBe(true);
    const read=await GET();expect(read.headers.get('Cache-Control')).toBe('no-store');expect((await read.json()).tariffs).toHaveLength(1);
  });
  it('rolls back both the new tariff and local audit when the admin audit fails',async()=>{
    state.audit.mockImplementation(()=>{throw Error('private details');});
    const response=await POST(request({action:'create',label:'Test'}));expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private details');
    expect(state.db.prepare('SELECT * FROM managed_tariffs').all()).toEqual([]);
    expect(state.db.prepare('SELECT * FROM managed_tariff_audit').all()).toEqual([]);
  });
});
