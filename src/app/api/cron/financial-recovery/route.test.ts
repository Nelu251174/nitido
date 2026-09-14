import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({run:vi.fn(),configured:vi.fn(),construct:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/financialRecovery',()=>({runFinancialRecovery:state.run,sandboxRecoveryConfigured:state.configured}));
vi.mock('stripe',()=>({default:class{constructor(key:string,options:unknown){state.construct(key,options);}}}));
import {POST} from './route';
const secret='fixture-only-secret-with-more-than-32-chars';
const call=(supplied=secret)=>POST(new NextRequest('http://localhost/api/cron/financial-recovery',{method:'POST',headers:{'x-recovery-secret':supplied},body:'{"event":"must not ingest"}'}));
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('NITIDO_FINANCIAL_RECOVERY_SECRET',secret);vi.stubEnv('STRIPE_SECRET_KEY','rk_test_fixture');state.configured.mockReturnValue(true);state.run.mockResolvedValue({status:'completed',attempted:0,processed:0,deferred:0,failed:0});});
afterEach(()=>vi.unstubAllEnvs());
describe('scheduler recovery authorization',()=>{
 it.each(['','short'])('requires a configured strong scheduler secret',async value=>{vi.stubEnv('NITIDO_FINANCIAL_RECOVERY_SECRET',value);expect((await call()).status).toBe(503);expect(state.construct).not.toHaveBeenCalled();});
 it('fails closed when sandbox configuration is not valid',async()=>{state.configured.mockReturnValue(false);expect((await call()).status).toBe(503);expect(state.run).not.toHaveBeenCalled();});
 it.each(['','other',secret.slice(0,-1)+'X'])('rejects invalid scheduler credentials',async value=>{expect((await call(value)).status).toBe(401);expect(state.construct).not.toHaveBeenCalled();});
 it('uses bounded Stripe calls and passes no request body to the worker',async()=>{const response=await call();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(state.construct).toHaveBeenCalledWith('rk_test_fixture',{timeout:8000,maxNetworkRetries:0});expect(state.run.mock.calls[0]).toHaveLength(2);});
 it('does not expose provider or token errors',async()=>{state.run.mockRejectedValue(Error(secret));const response=await call();expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain(secret);});
});
