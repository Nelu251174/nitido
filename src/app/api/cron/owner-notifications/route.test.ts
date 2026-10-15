import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({send:vi.fn(),enqueue:vi.fn(),reports:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/adminOwnerEvents',()=>({processOwnerEmails:state.send,enqueueOwnerEvent:state.enqueue}));
vi.mock('@/lib/adminOwnerReports',()=>({saveStoreReports:state.reports}));
import {POST} from './route';
function req(secret?:string,body?:unknown){return new Request('https://nitido.ro/api/cron/owner-notifications',{method:'POST',headers:secret?{'x-owner-cron-secret':secret}:{},body:body?JSON.stringify(body):undefined}) as never;}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NITIDO_OWNER_ALERTS_CRON_SECRET','o'.repeat(32));vi.stubEnv('CRON_SECRET','other'.repeat(10));state.send.mockResolvedValue({status:'completed',selected:0,accepted:0,failed:0,suppressed:0,uncertain:0});state.enqueue.mockReturnValue('test-event');});afterEach(()=>vi.unstubAllEnvs());
it('rejects missing keys and unrelated financial cron keys',async()=>{expect((await POST(req())).status).toBe(401);expect((await POST(req('other'.repeat(10)))).status).toBe(401);expect(state.send).not.toHaveBeenCalled();});
it('only processes approved actions and never accepts an arbitrary destination',async()=>{expect((await POST(req('o'.repeat(32),{action:'test',to:'other@test.test'}))).status).toBe(400);expect(state.enqueue).not.toHaveBeenCalled();expect((await POST(req('o'.repeat(32),{action:'test'}))).status).toBe(200);expect(state.send).toHaveBeenCalledWith({}, {ids:['test-event']});});
it('does not process email if a report import fails validation',async()=>{state.reports.mockImplementation(()=>{throw Error('INVALID_REPORT');});expect((await POST(req('o'.repeat(32),{action:'reports',reports:[],digestDate:'2026-10-15'}))).status).toBe(400);expect(state.send).not.toHaveBeenCalled();});
