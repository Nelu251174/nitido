import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
import type Database from 'better-sqlite3';
const mocks=vi.hoisted(()=>({actor:vi.fn(),db:null as Database.Database|null}));
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:mocks.actor}));
vi.mock('@/lib/db',async()=>{const Database=(await import('better-sqlite3')).default;mocks.db=new Database(':memory:');mocks.db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');return {db:mocks.db};});
import { GET,POST } from './route';
function req(body?:unknown,origin='https://sandbox.nitido.ro',query=''){return new NextRequest('https://sandbox.nitido.ro/api/admin/marketing/city'+query,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_MARKETING_ADMIN_ENABLED','true');mocks.actor.mockResolvedValue('synthetic-'+Math.random());mocks.db!.exec('DROP TABLE IF EXISTS marketing_city_items;DROP TABLE IF EXISTS marketing_city_jobs;');});
afterEach(()=>vi.unstubAllEnvs());
describe('whole city Marketing API',()=>{
 it('requires super_admin for reads, exports and mutations',async()=>{mocks.actor.mockResolvedValue(null);expect((await GET(req())).status).toBe(401);expect((await GET(req(undefined,undefined,'?format=csv&id=fixture'))).status).toBe(401);expect((await POST(req({action:'start',data:{city:'Constanța'}}))).status).toBe(401);expect(mocks.actor.mock.calls.every(args=>args[0]==='super_admin')).toBe(true);});
 it('rejects cross-origin starts and remains disabled outside the configured feature origin',async()=>{expect((await POST(req({action:'start',data:{city:'Constanța'}},'https://evil.example'))).status).toBe(403);vi.stubEnv('NITIDO_MARKETING_ADMIN_ENABLED','false');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://nitido.ro');expect((await GET(req())).status).toBe(404);});
 it('starts, reports and pauses the municipality without external calls or campaign sends',async()=>{const network=vi.spyOn(globalThis,'fetch');const start=await POST(req({action:'start',data:{city:'CONSTANTA'}}));expect(start.status).toBe(202);const body=await start.json();expect(body.view.job.city).toBe('Constanța');expect(body.view.job.state).toBe('queued');expect((await (await GET(req())).json()).view.job.id).toBe(body.view.job.id);const pause=await POST(req({action:'pause',id:body.view.job.id}));expect((await pause.json()).view.job.state).toBe('paused');expect(network).not.toHaveBeenCalled();network.mockRestore();});
 it('rejects invalid actions and invalid pages instead of accepting an unbounded body shape',async()=>{expect((await POST(req({action:'invalid'}))).status).toBe(400);expect((await POST(req({action:'start',data:{city:''}}))).status).toBe(400);expect((await GET(req(undefined,undefined,'?page=-1'))).status).toBe(400);});
});
