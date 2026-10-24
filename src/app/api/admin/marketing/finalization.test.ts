import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type Database from 'better-sqlite3';
const mocks=vi.hoisted(()=>({actor:vi.fn(),db:null as Database.Database|null}));
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:mocks.actor}));
vi.mock('@/lib/db',async()=>{const Database=(await import('better-sqlite3')).default;mocks.db=new Database(':memory:');return {db:mocks.db};});
import { GET as deliveryGet,POST as deliveryPost } from './delivery/route';
import { GET as discoveryGet,POST as discoveryPost } from './discovery/route';
import { POST as unsubscribe } from '../../marketing/unsubscribe/route';
import { POST as webhook } from '../../marketing/webhook/route';
function req(path:string,body?:unknown,origin='https://sandbox.nitido.ro'){return new NextRequest('https://sandbox.nitido.ro/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');mocks.actor.mockResolvedValue('synthetic-'+Math.random());vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','false');vi.stubEnv('NITIDO_MARKETING_WEBHOOK_SECRET','');});
afterEach(()=>vi.unstubAllEnvs());
describe('Marketing finalization route boundaries',()=>{
 it('guards discovery status, outbox reports and captured messages with super_admin',async()=>{mocks.actor.mockResolvedValue(null);for(const [fn,path] of [[deliveryGet,'admin/marketing/delivery?run=fixture'],[discoveryGet,'admin/marketing/discovery?id=fixture']] as const)expect((await fn(req(path))).status).toBe(401);expect((await deliveryPost(req('admin/marketing/delivery',{action:'process'}))).status).toBe(401);expect((await discoveryPost(req('admin/marketing/discovery',{action:'start'}))).status).toBe(401);expect(mocks.actor.mock.calls.every(args=>args[0]==='super_admin')).toBe(true);});
 it('blocks cross-origin and missing-origin mutations with an existing admin session',async()=>{for(const fn of [deliveryPost,discoveryPost])expect((await fn(req('admin/marketing/test',{action:'process'},'https://evil.example'))).status).toBe(403);const missing=req('admin/marketing/delivery',{action:'process'});missing.headers.delete('Origin');expect((await deliveryPost(missing)).status).toBe(403);expect((await unsubscribe(req('marketing/unsubscribe',{token:'invalid'},'https://evil.example'))).status).toBe(403);});
 it('keeps all new endpoints unavailable on LIVE',async()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://nitido.ro');for(const fn of [deliveryPost,discoveryPost,unsubscribe,webhook])expect((await fn(req('any',{action:'process'}))).status).toBe(404);});
 it('rejects invalid actions and unconfigured or oversized webhooks',async()=>{expect((await deliveryPost(req('admin/marketing/delivery',{action:'invalid'}))).status).toBe(400);expect((await discoveryPost(req('admin/marketing/discovery',{action:'invalid'}))).status).toBe(400);expect((await webhook(req('marketing/webhook',{type:'email.delivered'}))).status).toBe(503);expect((await webhook(req('marketing/webhook',{data:'x'.repeat(65000)}))).status).toBe(413);});
});
