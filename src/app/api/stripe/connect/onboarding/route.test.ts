import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({user:vi.fn(),create:vi.fn(),db:{prepare:vi.fn()}}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/db',()=>({db:mocks.db}));
vi.mock('@/lib/stripeConnect',()=>({createOnboardingLink:mocks.create}));
import {GET,POST} from './route';
const req=(method:string,headers:Record<string,string>={})=>new NextRequest('https://nitido.ro/api/stripe/connect/onboarding',{method,headers});
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:'test-firm',role:'firma'});mocks.create.mockResolvedValue('https://connect.stripe.com/test-only');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://nitido.ro');});
describe('onboarding method safety',()=>{
 it('GET refresh redirects without authentication cleanup, SQL or Stripe calls',async()=>{const r=await GET(req('GET'));expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('https://nitido.ro/firma?stripe=refresh-required');expect(mocks.user).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();expect(mocks.db.prepare).not.toHaveBeenCalled()});
 it('requires a firm and rejects cross-origin POST',async()=>{mocks.user.mockResolvedValueOnce({id:'c',role:'client'});expect((await POST(req('POST'))).status).toBe(401);expect((await POST(req('POST',{origin:'https://foreign.example'}))).status).toBe(403);expect(mocks.create).not.toHaveBeenCalled()});
 it('scopes retry idempotency to the authenticated firm and preserves public return origin',async()=>{const headers={origin:'https://nitido.ro','idempotency-key':'test-action-1234567890'};expect((await POST(req('POST',headers))).status).toBe(200);const first=mocks.create.mock.calls[0];await POST(req('POST',headers));expect(mocks.create.mock.calls[1]).toEqual(first);expect(first[1]).toBe('test-firm');expect(first[2]).toBe('https://nitido.ro');expect(first[3]).toMatch(/^nitido-onboarding-[a-f0-9]{64}$/)});
 it('keeps existing POST callers without an action key compatible',async()=>{expect((await POST(req('POST'))).status).toBe(200);expect(mocks.create).toHaveBeenCalledWith(mocks.db,'test-firm','https://nitido.ro',undefined)});
});
