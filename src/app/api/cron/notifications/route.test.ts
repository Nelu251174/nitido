import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({run:vi.fn(),configured:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/notificationRecovery',()=>({runNotificationRecovery:state.run,notificationRecoveryConfigured:state.configured}));
import {POST} from './route';
const secret='test-only-cron-secret-more-than-32-characters';
const call=(value=secret)=>POST(new NextRequest('http://localhost/api/cron/notifications',{method:'POST',headers:{'x-cron-secret':value},body:'{"recipient":"not-trusted"}'}));
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('CRON_SECRET',secret);state.configured.mockReturnValue(true);state.run.mockResolvedValue({status:'completed',recovered:0,quarantined:0,pushSelected:0,smsSelected:0});});
afterEach(()=>vi.unstubAllEnvs());
describe('notification recovery scheduler authorization',()=>{
 it.each(['','short'])('requires a configured strong secret: %s',async value=>{vi.stubEnv('CRON_SECRET',value);expect((await call()).status).toBe(503);expect(state.run).not.toHaveBeenCalled();});
 it('requires sandbox enablement',async()=>{state.configured.mockReturnValue(false);expect((await call()).status).toBe(503);expect(state.run).not.toHaveBeenCalled();});
 it.each(['','wrong',secret.slice(0,-1)+'X'])('rejects invalid credentials: %s',async value=>{expect((await call(value)).status).toBe(401);expect(state.run).not.toHaveBeenCalled();});
 it('ignores body targets and returns no-store counters',async()=>{const response=await call();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(state.run.mock.calls[0]).toHaveLength(1);});
 it('hides internal errors',async()=>{state.run.mockRejectedValue(Error(secret));const response=await call();expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain(secret);});
});
