import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({get:vi.fn(),stripe:vi.fn(),recover:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{prepare:()=>({get:state.get})}}));
vi.mock('@/lib/payments',()=>({getStripeClient:state.stripe}));
vi.mock('@/lib/authorizationCoverage',()=>({recoverAuthorizationCoverage:state.recover}));
import {POST} from './route';
const secret='synthetic-cron-secret-at-least-32-characters';
const call=(value=secret)=>POST(new NextRequest('http://localhost/api/cron/authorization-coverage',{method:'POST',headers:{'x-cron-secret':value}}));
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('CRON_SECRET',secret);state.stripe.mockReturnValue({});state.recover.mockResolvedValue({attempted:1,released:1})});
afterEach(()=>vi.unstubAllEnvs());
describe('bounded authorization cleanup route',()=>{
 it.each(['','short'])('requires configured strong credentials',async value=>{vi.stubEnv('CRON_SECRET',value);expect((await call()).status).toBe(503);expect(state.get).not.toHaveBeenCalled();expect(state.stripe).not.toHaveBeenCalled()});
 it.each(['','wrong'])('rejects unauthorized access before DB or processor calls',async value=>{expect((await call(value)).status).toBe(401);expect(state.get).not.toHaveBeenCalled();expect(state.recover).not.toHaveBeenCalled()});
 it('does not instantiate Stripe when no cleanup is due',async()=>{state.get.mockReturnValue(undefined);expect(await (await call()).json()).toEqual({attempted:0,released:0});expect(state.stripe).not.toHaveBeenCalled()});
 it('uses a bounded processor client and ignores caller data',async()=>{state.get.mockReturnValue({1:1});expect(await (await call()).json()).toEqual({attempted:1,released:1});expect(state.stripe).toHaveBeenCalledWith({timeout:4000,maxNetworkRetries:0});expect(state.recover).toHaveBeenCalledTimes(1)});
});
