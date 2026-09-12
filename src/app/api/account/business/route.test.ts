import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),origin:vi.fn(),rate:vi.fn(),save:vi.fn(),get:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/security',()=>({hasTrustedMutationOrigin:mocks.origin,consumeRateLimit:mocks.rate}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/business',()=>({setBusinessProfile:mocks.save,getBusinessProfile:mocks.get}));
import {GET,POST} from './route';
const req=(body='{}')=>new Request('https://sandbox.nitido.ro/api/account/business',{method:'POST',body}) as never;
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:'client',role:'client'});mocks.origin.mockReturnValue(true);mocks.rate.mockReturnValue(true);mocks.save.mockReturnValue({ok:true});mocks.get.mockReturnValue({isBusiness:true})});
describe('business profile API',()=>{
 it('denies anonymous and firm accounts',async()=>{for(const user of [null,{id:'f',role:'firma'}]){mocks.user.mockResolvedValue(user);expect((await GET(req())).status).toBe(401);expect((await POST(req())).status).toBe(401)}expect(mocks.save).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled()});
 it('blocks untrusted writes',async()=>{mocks.origin.mockReturnValue(false);expect((await POST(req())).status).toBe(403);expect(mocks.save).not.toHaveBeenCalled()});
 it('rejects malformed shapes and oversized bodies',async()=>{for(const body of ['bad','null','[]','42'])expect((await POST(req(body))).status).toBe(400);expect((await POST(req('x'.repeat(10001)))).status).toBe(413);expect(mocks.save).not.toHaveBeenCalled()});
 it('rate limits writes',async()=>{mocks.rate.mockReturnValue(false);expect((await POST(req())).status).toBe(429);expect(mocks.save).not.toHaveBeenCalled()});
 it('uses the authenticated owner rather than a supplied user id',async()=>{expect((await POST(req(JSON.stringify({userId:'other',companyName:'A',companyCui:'RO123'})))).status).toBe(200);expect(mocks.save).toHaveBeenCalledWith({},'client',{companyName:'A',companyCui:'RO123',companyAddress:undefined});expect((await GET(req())).headers.get('Cache-Control')).toBe('private, no-store')});
});
