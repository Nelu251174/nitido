import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type Database from 'better-sqlite3';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), audit: vi.fn(), db: null as Database.Database | null }));
vi.mock('@/lib/adminAuth', () => ({ getAdminActorId: mocks.actor, auditAdminAction: mocks.audit }));
vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  mocks.db = new Database(':memory:');
  return { db: mocks.db };
});
import { GET, POST, PATCH } from './contacts/route';
import { POST as collect } from './collect/route';
import { hasAdminPermission } from '@/lib/adminRolesShared';

const row = { name: 'Contact sintetic', category: 'business', email: 'synthetic@example.test', city: 'Constanța', source: 'Test izolat' };
function request(path = 'contacts', method = 'GET', body?: unknown, origin = 'https://sandbox.nitido.ro') {
  return new NextRequest(`https://sandbox.nitido.ro/api/admin/marketing/${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: origin }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sandbox.nitido.ro');
  mocks.actor.mockResolvedValue('synthetic-super-admin');
  mocks.db!.exec('DROP TABLE IF EXISTS marketing_contacts');
});
afterEach(() => vi.unstubAllEnvs());
describe('Marketing ADMIN boundary', () => {
  it('requires the super_admin permission for reads, collection previews, writes and export', async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request('contacts?format=csv'))).status).toBe(401);
    expect((await POST(request('contacts', 'POST', { contacts: [row] }))).status).toBe(401);
    expect((await PATCH(request('contacts', 'PATCH', {}))).status).toBe(401);
    expect((await collect(request('collect', 'POST', { source: 'anaf' }))).status).toBe(401);
    expect(mocks.actor.mock.calls.every(call => call[0] === 'super_admin')).toBe(true);
    for (const role of ['operator', 'manager', 'finance'] as const) expect(hasAdminPermission(role, 'super_admin')).toBe(false);
    expect(mocks.db!.prepare("SELECT name FROM sqlite_master WHERE name='marketing_contacts'").get()).toBeUndefined();
  });
  it('returns 404 in LIVE before authorizing or accessing storage', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://nitido.ro');
    expect((await GET(request())).status).toBe(404);
    expect((await POST(request('contacts', 'POST', { contacts: [row] }))).status).toBe(404);
    expect((await collect(request('collect', 'POST', {}))).status).toBe(404);
    expect(mocks.actor).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('rejects cross-origin mutations even with a bearer-looking header', async () => {
    vi.stubEnv('NITIDO_ENABLE_BEARER_AUTH', 'true');
    const req = request('contacts', 'POST', { contacts: [row] }, 'https://evil.test'); req.headers.set('authorization', 'Bearer fake');
    expect((await POST(req)).status).toBe(403);
    expect((await PATCH(request('contacts', 'PATCH', {}, 'https://evil.test'))).status).toBe(403);
    expect((await collect(request('collect', 'POST', {}, 'https://evil.test'))).status).toBe(403);
    const missingOrigin = request('contacts', 'POST', { contacts: [row] }); missingOrigin.headers.delete('origin');
    expect((await POST(missingOrigin)).status).toBe(403);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
describe('Marketing contact workflow without messaging', () => {
  it('previews, filters and explicitly saves a CSV batch without any external fetch', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('No network in contact workflow'));
    try {
      const response = await collect(request('collect', 'POST', { source: 'csv', category: 'business', city: 'constanta', csv: 'name,category,email,city,source\nFirma test,business,synthetic@example.test,Constanța,Synthetic\nFirma curățenie,cleaning,clean@example.test,București,Synthetic' }));
      expect(response.status).toBe(200);
      const preview = await response.json(); expect(preview.contacts).toHaveLength(1); expect(preview.excluded).toBe(1);
      expect((await (await GET(request())).json()).total).toBe(0);
      expect((await POST(request('contacts', 'POST', { contacts: preview.contacts }))).status).toBe(201);
      expect((await (await GET(request())).json()).total).toBe(1);
      expect(mocks.audit).toHaveBeenCalledWith('marketing.contacts.saved', 'synthetic-super-admin', { created: 1, duplicates: 0 });
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('rejects malformed bodies, oversized requests and invalid rows before saving', async () => {
    const malformed = new NextRequest('https://sandbox.nitido.ro/api/admin/marketing/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://sandbox.nitido.ro' }, body: '{' });
    expect((await POST(malformed)).status).toBe(400);
    expect((await POST(request('contacts', 'POST', { contacts: [row, { ...row, name: '' }] }))).status).toBe(400);
    const huge = request('contacts', 'POST', { text: 'a'.repeat(500001) });
    expect((await POST(huge)).status).toBe(413);
    expect((await (await GET(request())).json()).total).toBe(0);
  });
  it('rolls back the contacts if the audit cannot be written', async () => {
    mocks.audit.mockImplementationOnce(() => { throw Error('audit unavailable'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await POST(request('contacts', 'POST', { contacts: [row] }))).status).toBe(500);
      expect((await (await GET(request())).json()).total).toBe(0);
      expect((await POST(request('contacts', 'POST', { contacts: [row] }))).status).toBe(201);
    } finally { log.mockRestore(); }
  });
  it('exports as a private attachment and persists withdrawal without a send action', async () => {
    await POST(request('contacts', 'POST', { contacts: [row] }));
    const { contacts } = await (await GET(request())).json();
    expect((await PATCH(request('contacts', 'PATCH', { ...contacts[0], consent: 'withdrawn' }))).status).toBe(200);
    expect((await (await GET(request())).json()).contacts[0].status).toBe('do_not_contact');
    const csv = await GET(request('contacts?format=csv'));
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.headers.get('cache-control')).toBe('private, no-store');
    expect(await csv.text()).toContain('do_not_contact');
  });
});
