import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({user:vi.fn(),confirm:vi.fn(),origin:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/payments',()=>({getStripeClient:()=>({})}));
vi.mock('@/lib/security',()=>({hasTrustedMutationOrigin:mocks.origin,consumeRateLimit:mocks.limit}));
vi.mock('@/lib/cardConfirmation',()=>({cardConfirmation:mocks.confirm,CardConfirmationError:class extends Error{status=409}}));
import {POST} from './route';
const call=(action='start')=>POST(new NextRequest('https://nitido.ro/api/jobs/j/authorize-card',{method:'POST',body:JSON.stringify({action})}),{params:Promise.resolve({id:'j'})});
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:'u',role:'client'});mocks.origin.mockReturnValue(true);mocks.limit.mockReturnValue(true);});
describe('card confirmation HTTP boundary',()=>{
 it.each([null,{id:'f',role:'firma'},{id:'a',role:'admin'}])('rejects unauthorized roles %j',async user=>{mocks.user.mockResolvedValue(user);expect((await call()).status).toBe(401);expect(mocks.confirm).not.toHaveBeenCalled();});
 it('rejects untrusted origins before payment access',async()=>{mocks.origin.mockReturnValue(false);expect((await call()).status).toBe(403);expect(mocks.confirm).not.toHaveBeenCalled();});
 it('enforces rate limits',async()=>{mocks.limit.mockReturnValue(false);expect((await call()).status).toBe(429);expect(mocks.confirm).not.toHaveBeenCalled();});
 it('rejects unknown actions',async()=>{expect((await call('capture')).status).toBe(400);expect(mocks.confirm).not.toHaveBeenCalled();});
 it('passes authenticated ownership and prevents response caching',async()=>{mocks.confirm.mockResolvedValue({status:'requires_action',clientSecret:'fixture_secret'});const res=await call();expect(mocks.confirm).toHaveBeenCalledWith({}, {}, 'u','j','start');expect(res.headers.get('cache-control')).toBe('private, no-store');expect(res.headers.get('referrer-policy')).toBe('no-referrer');});
 it('does not return provider error details',async()=>{mocks.confirm.mockRejectedValue(Error('fixture private detail'));const res=await call();expect(res.status).toBe(502);expect(JSON.stringify(await res.json())).not.toContain('fixture private detail');});
});
