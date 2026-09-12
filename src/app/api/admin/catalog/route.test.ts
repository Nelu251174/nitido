import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({isAdmin:vi.fn(),origin:vi.fn(),transaction:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/adminAuth',()=>({isAdmin:mocks.isAdmin,auditAdminAction:mocks.audit}));
vi.mock('@/lib/security',()=>({hasTrustedMutationOrigin:mocks.origin}));
vi.mock('@/lib/db',()=>({db:{transaction:mocks.transaction}}));
import {GET,POST} from './route';
const request=()=>new Request('https://sandbox.nitido.ro/api/admin/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'general',version:0,definition:{}})}) as never;
beforeEach(()=>{vi.clearAllMocks();mocks.isAdmin.mockResolvedValue(false);mocks.origin.mockReturnValue(false)});
describe('catalog administration access',()=>{
 it('rejects unauthenticated reads and mutations',async()=>{expect((await GET()).status).toBe(401);expect((await POST(request())).status).toBe(401);expect(mocks.transaction).not.toHaveBeenCalled()});
 it('rejects untrusted mutation origins even for an authenticated administrator',async()=>{mocks.isAdmin.mockResolvedValue(true);expect((await POST(request())).status).toBe(403);expect(mocks.transaction).not.toHaveBeenCalled()});
});
