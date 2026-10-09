import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ user: vi.fn(), sync: vi.fn(), info: vi.fn(), create: vi.fn(), origin: vi.fn(), limit: vi.fn(), setDefault:vi.fn(), remove:vi.fn() }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/clientPayments', () => ({ syncClientDefaultCard: mocks.sync, getClientCards: mocks.info, createCardSetupSession: mocks.create, CardSetupError: class extends Error { status = 409; } }));
vi.mock('@/lib/savedCards',()=>({setDefaultCard:mocks.setDefault,removeSavedCard:mocks.remove}));
vi.mock('@/lib/security', () => ({ hasTrustedMutationOrigin: mocks.origin, consumeRateLimit: mocks.limit }));
import { GET, POST, PATCH, DELETE } from './route';
import { POST as checkout } from '../checkout/route';
const call = (body: unknown = { sessionId: 'cs_test_current' }) => POST(new NextRequest('https://sandbox.nitido.ro/api/payments/card', { method: 'POST', body: JSON.stringify(body) }));
const start = () => checkout(new NextRequest('https://sandbox.nitido.ro/api/payments/checkout', { method: 'POST' }));
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: 'owner', role: 'client' }); mocks.origin.mockReturnValue(true); mocks.limit.mockReturnValue(true); mocks.sync.mockResolvedValue(true); mocks.create.mockResolvedValue({ configured: true, url: 'https://checkout.stripe.com/test' }); });
describe('card setup HTTP boundaries', () => {
  it.each([null, { id: 'f', role: 'firma' }, { id: 'a', role: 'admin' }])('blocks other roles %j at both mutations', async user => {
    mocks.user.mockResolvedValue(user); expect((await call()).status).toBe(401); expect((await start()).status).toBe(401); expect(mocks.sync).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('blocks untrusted origins before Stripe calls', async () => { mocks.origin.mockReturnValue(false); expect((await call()).status).toBe(403); expect((await start()).status).toBe(403); expect(mocks.sync).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); });
  it('limits repeated attempts', async () => { mocks.limit.mockReturnValue(false); expect((await call()).status).toBe(429); expect((await start()).status).toBe(429); });
  it.each([null, {}, { sessionId: 42 }])('rejects missing session data %j', async body => { expect((await call(body)).status).toBe(400); expect(mocks.sync).not.toHaveBeenCalled(); });
  it('uses the authenticated owner, never an injected user ID', async () => { const res = await call({ sessionId: 'cs_test_current', userId: 'victim' }); expect(res.status).toBe(200); expect(mocks.sync).toHaveBeenCalledWith({}, 'owner', 'cs_test_current'); expect(res.headers.get('cache-control')).toBe('private, no-store'); });
  it('does not claim success when the new card was not confirmed', async () => { mocks.sync.mockResolvedValue(false); expect((await call()).status).toBe(409); });
  it('does not disclose provider errors from either endpoint', async () => { mocks.sync.mockRejectedValue(Error('private provider details')); mocks.create.mockRejectedValue(Error('private provider details')); for (const res of [await call(), await start()]) { expect(res.status).toBe(502); expect(JSON.stringify(await res.json())).not.toContain('private provider details'); } });
  it('does not expose Stripe identifiers in card status', async () => { mocks.info.mockResolvedValue({ hasCard: true, stripeConfigured: true, maxCards:3,cards:[] }); const res = await GET(new NextRequest('https://sandbox.nitido.ro/api/payments/card')); expect(await res.json()).toEqual({ hasCard: true, stripeConfigured: true,maxCards:3,cards:[] }); expect(res.headers.get('cache-control')).toBe('private, no-store'); });
});

describe('saved card management boundaries',()=>{
 const change=(method:'PATCH'|'DELETE',body:unknown={cardId:'card_fixture'})=>(method==='PATCH'?PATCH:DELETE)(new NextRequest('https://sandbox.nitido.ro/api/payments/card',{method,body:JSON.stringify(body)}));
 it.each([null,{id:'firm',role:'firma'}])('blocks other roles %j',async user=>{mocks.user.mockResolvedValue(user);for(const method of ['PATCH','DELETE'] as const)expect((await change(method)).status).toBe(401);expect(mocks.remove).not.toHaveBeenCalled();expect(mocks.setDefault).not.toHaveBeenCalled();});
 it('blocks untrusted origins',async()=>{mocks.origin.mockReturnValue(false);for(const method of ['PATCH','DELETE'] as const)expect((await change(method)).status).toBe(403);});
 it.each([null,{}, {cardId:4},{cardId:'pm_injected'}])('rejects malformed card references %j',async body=>{for(const method of ['PATCH','DELETE'] as const)expect((await change(method,body)).status).toBe(400);});
 it('uses the authenticated user for default and removal',async()=>{await change('PATCH',{cardId:'card_fixture',userId:'victim'});await change('DELETE',{cardId:'card_fixture',userId:'victim'});expect(mocks.setDefault).toHaveBeenCalledWith({},'owner','card_fixture');expect(mocks.remove).toHaveBeenCalledWith({},'owner','card_fixture');});
});
