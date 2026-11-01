import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
import {internationalCostExample} from '@/lib/adminInternationalCosts';
import {hasAdminPermission,type AdminRole} from '@/lib/adminRolesShared';
const state=vi.hoisted(()=>({db:null as unknown as Database.Database,role:null as string|null,accesses:0,audit:vi.fn()}));
vi.mock('@/lib/db',()=>({get db(){state.accesses++;return state.db;}}));
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:async(permission:'finance')=>state.role&&hasAdminPermission(state.role as AdminRole,permission)?'admin-test':null,auditAdminAction:state.audit}));
import {GET,POST} from './route';
const id='11111111-1111-4111-8111-111111111111';
const request=(body:unknown)=>new NextRequest('https://sandbox.nitido.ro/api/admin/international-costs',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://sandbox.nitido.ro'},body:JSON.stringify(body)});
const save=(input=internationalCostExample(),revision=0)=>request({action:'save',id,revision,input});
const tables=()=>state.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
beforeEach(()=>{vi.clearAllMocks();state.role='super_admin';state.accesses=0;state.db=new Database(':memory:');});
afterEach(()=>state.db.close());
describe('admin international cost drafts API',()=>{
 it('denies visitors, clients, operators and managers before reading any private registry',async()=>{
  for(const role of [null,'client','operator','manager']){state.role=role;expect((await GET()).status).toBe(401);expect((await POST(save())).status).toBe(401);}
  expect(state.accesses).toBe(0);expect(state.audit).not.toHaveBeenCalled();expect(tables()).toEqual([]);
 });
 it('permits finance and super-admin reads without schema or booking writes',async()=>{
  for(const role of ['finance','super_admin']){state.role=role;const r=await GET();expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(await r.json()).toMatchObject({drafts:[],activationAvailable:false,romaniaUnchanged:true});}
  expect(tables()).toEqual([]);
 });
 it('rejects missing or cross-origin admin mutations even with a Bearer-looking header',async()=>{
  for(const origin of [undefined,'https://attacker.invalid']){const headers:Record<string,string>={'Content-Type':'application/json',Authorization:'Bearer synthetic-unused'};if(origin)headers.Origin=origin;const r=new NextRequest('https://sandbox.nitido.ro/api/admin/international-costs',{method:'POST',headers,body:JSON.stringify({action:'save',id,revision:0,input:internationalCostExample()})});expect((await POST(r)).status).toBe(403);}
  expect(tables()).toEqual([]);
 });
 it('simulates on the server without creating a table or audit entry',async()=>{
  const r=await POST(request({action:'simulate',input:internationalCostExample()}));expect(r.status).toBe(200);expect((await r.json()).calculation).toMatchObject({netTotalMinor:15900,executable:false});expect(tables()).toEqual([]);expect(state.audit).not.toHaveBeenCalled();
 });
 it('saves an idempotent draft with server-calculated results',async()=>{
  const first=await POST(save()),a=await first.json();expect(first.status).toBe(200);expect(a.draft.revision).toBe(1);
  const retry=await POST(save());expect(retry.status).toBe(200);expect((await retry.json()).draft.revision).toBe(1);expect(state.audit).toHaveBeenCalledTimes(1);
  expect((await (await GET()).json()).drafts).toHaveLength(1);
 });
 it('enforces optimistic revisions and makes a repeated update idempotent',async()=>{
  await POST(save());const changed={...internationalCostExample(),city:'Oraș sintetic diferit'};
  const updated=await POST(save(changed,1));expect((await updated.json()).draft.revision).toBe(2);
  expect((await POST(save())).status).toBe(409);
  expect((await (await POST(save(changed,1))).json()).draft.revision).toBe(2);expect(state.audit).toHaveBeenCalledTimes(2);
 });
 it('rejects Romanian overrides and unsupported currencies without creating schema',async()=>{
  expect((await POST(save({...internationalCostExample(),countryCode:'RO' as never,currency:'RON' as never}))).status).toBe(400);
  expect((await POST(save({...internationalCostExample(),currency:'USD' as never}))).status).toBe(400);expect(tables()).toEqual([]);
 });
 it('does not accept publish, activate, payment or deletion actions',async()=>{
  for(const action of ['publish','activate','pay','delete'])expect((await POST(request({action,id,input:internationalCostExample()}))).status).toBe(400);
  expect(tables()).toEqual([]);expect(state.audit).not.toHaveBeenCalled();
 });
 it('rolls the saved draft and lazy schema back if auditing fails',async()=>{
  state.audit.mockImplementation(()=>{throw Error('private diagnostic');});const r=await POST(save());expect(r.status).toBe(500);expect(JSON.stringify(await r.json())).not.toContain('private diagnostic');expect(tables()).toEqual([]);
 });
 it('rejects malformed JSON and oversized requests',async()=>{
  expect((await POST(new NextRequest('https://sandbox.nitido.ro/api/admin/international-costs',{method:'POST',headers:{Origin:'https://sandbox.nitido.ro'},body:'{'}))).status).toBe(400);
  expect((await POST(request({action:'save',input:'x'.repeat(24001)}))).status).toBe(413);expect(tables()).toEqual([]);
 });
});
