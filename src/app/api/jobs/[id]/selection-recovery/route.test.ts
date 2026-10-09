import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ user:vi.fn(),origin:vi.fn(),limit:vi.fn(),recover:vi.fn() }));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/security',()=>({hasTrustedMutationOrigin:mocks.origin,consumeRateLimit:mocks.limit}));
vi.mock('@/lib/selectionRecovery',()=>({recoverSelection:mocks.recover}));
import { POST } from './route';
const call=()=>POST(new NextRequest('https://nitido.ro/api/jobs/j/selection-recovery',{method:'POST'}),{params:Promise.resolve({id:'j'})});
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:'owner',role:'client'});mocks.origin.mockReturnValue(true);mocks.limit.mockReturnValue(true);mocks.recover.mockReturnValue({ok:true,status:200});});
describe('selection recovery HTTP authorization',()=>{
 it.each([null,{id:'f',role:'firma'},{id:'a',role:'admin'}])('rejects non-client access %j',async user=>{mocks.user.mockResolvedValue(user);expect((await call()).status).toBe(401);expect(mocks.recover).not.toHaveBeenCalled();});
 it('rejects an untrusted origin before any recovery write',async()=>{mocks.origin.mockReturnValue(false);expect((await call()).status).toBe(403);expect(mocks.recover).not.toHaveBeenCalled();});
 it('enforces per-user retry limits',async()=>{mocks.limit.mockReturnValue(false);expect((await call()).status).toBe(429);expect(mocks.recover).not.toHaveBeenCalled();});
 it('uses the authenticated user and private non-cacheable output',async()=>{const response=await call();expect(mocks.recover).toHaveBeenCalledWith({},'j','owner');expect(await response.json()).toEqual({ok:true});expect(response.headers.get('cache-control')).toBe('private, no-store');});
 it.each([403,409,503])('returns %i without receipt, token or financial data',async status=>{mocks.recover.mockReturnValue({ok:false,status});const response=await call();expect(response.status).toBe(status);expect(Object.keys(await response.json())).toEqual(['error']);});
});
