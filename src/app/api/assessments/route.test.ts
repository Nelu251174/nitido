import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),admin:vi.fn(),origin:vi.fn(),rate:vi.fn(),prepare:vi.fn(),transaction:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/adminAuth',()=>({isAdmin:mocks.admin,auditAdminAction:vi.fn()}));
vi.mock('@/lib/security',()=>({hasTrustedMutationOrigin:mocks.origin,consumeRateLimit:mocks.rate}));
vi.mock('@/lib/db',()=>({db:{prepare:mocks.prepare,transaction:mocks.transaction}}));
import {GET,POST} from './route';
import {GET as adminGet,POST as adminPost} from '../admin/assessments/route';
const req=(body='{}')=>new Request('https://sandbox.nitido.ro/api/assessments',{method:'POST',body,headers:{'Content-Type':'application/json'}}) as never;
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue(null);mocks.admin.mockResolvedValue(false);mocks.origin.mockReturnValue(false);mocks.rate.mockReturnValue(true)});
describe('assessment API access boundaries',()=>{
 it('rejects anonymous client and admin access without reading records',async()=>{expect((await GET(req())).status).toBe(401);expect((await POST(req())).status).toBe(401);expect((await adminGet()).status).toBe(401);expect((await adminPost(req())).status).toBe(401);expect(mocks.prepare).not.toHaveBeenCalled()});
 it('does not allow firm accounts to access client assessments',async()=>{mocks.user.mockResolvedValue({id:'f',role:'firma'});expect((await GET(req())).status).toBe(401);expect((await POST(req())).status).toBe(401);expect(mocks.prepare).not.toHaveBeenCalled()});
 it('rejects cross-origin client and admin mutations',async()=>{mocks.user.mockResolvedValue({id:'c',role:'client'});mocks.admin.mockResolvedValue(true);expect((await POST(req())).status).toBe(403);expect((await adminPost(req())).status).toBe(403);expect(mocks.transaction).not.toHaveBeenCalled()});
 it('rejects malformed and oversized input before database mutation',async()=>{mocks.user.mockResolvedValue({id:'c',role:'client'});mocks.origin.mockReturnValue(true);expect((await POST(req('bad'))).status).toBe(400);expect((await POST(req('x'.repeat(20001)))).status).toBe(413);expect(mocks.transaction).not.toHaveBeenCalled()});
 it('limits repeated submissions',async()=>{mocks.user.mockResolvedValue({id:'c',role:'client'});mocks.origin.mockReturnValue(true);mocks.rate.mockReturnValue(false);expect((await POST(req())).status).toBe(429);expect(mocks.transaction).not.toHaveBeenCalled()});
});
