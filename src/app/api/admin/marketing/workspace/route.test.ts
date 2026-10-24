import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type Database from 'better-sqlite3';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), db: null as Database.Database | null }));
vi.mock('@/lib/adminAuth', () => ({ getAdminActorId: mocks.actor }));
vi.mock('@/lib/db', async () => { const { default: Database } = await import('better-sqlite3'); mocks.db = new Database(':memory:'); return { db: mocks.db }; });
import { GET, POST } from './route';
const req = (body?: unknown, origin = 'https://sandbox.nitido.ro') => new NextRequest('https://sandbox.nitido.ro/api/admin/marketing/workspace', { method: body ? 'POST' : 'GET', headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sandbox.nitido.ro'); mocks.actor.mockResolvedValue('synthetic-admin-workspace'); mocks.db!.exec('DROP TABLE IF EXISTS marketing_simulations; DROP TABLE IF EXISTS marketing_campaigns; DROP TABLE IF EXISTS marketing_collection_runs; DROP TABLE IF EXISTS marketing_settings; DROP TABLE IF EXISTS marketing_contacts; CREATE TABLE IF NOT EXISTS admin_audit_log(id TEXT,action TEXT,target_id TEXT,details TEXT);'); });
afterEach(() => vi.unstubAllEnvs());
describe('full Marketing ADMIN workspace boundary', () => {
  it('requires super_admin for every workspace action before accessing storage', async () => {
    mocks.actor.mockResolvedValue(null); expect((await GET(req())).status).toBe(401);
    for (const action of ['settings', 'save', 'state', 'preview', 'simulate', 'send']) expect((await POST(req({ action }))).status).toBe(401);
    expect(mocks.actor.mock.calls.every(call => call[0] === 'super_admin')).toBe(true);
    expect(mocks.db!.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_campaigns'").get()).toBeUndefined();
  });
  it('is unavailable on LIVE and blocks foreign/missing origins', async () => {
    expect((await POST(req({ action: 'save' }, 'https://evil.test'))).status).toBe(403);
    const noOrigin = req({ action: 'save' }); noOrigin.headers.delete('origin'); expect((await POST(noOrigin)).status).toBe(403);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://nitido.ro'); expect((await GET(req())).status).toBe(404); expect((await POST(req({ action: 'simulate' }))).status).toBe(404);
  });
  it('cannot activate a sender or real delivery through settings or invented actions', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('No network expected'));
    try {
      expect((await POST(req({ action: 'send' }))).status).toBe(400);
      const current = await (await GET(req())).json();
      const response = await POST(req({ action: 'settings', data: { ...current.settings, deliveryEnabled: true } })); expect(response.status).toBe(200);
      const saved = await (await GET(req())).json(); expect(saved.deliveryEnabled).toBe(false); expect(saved.settings.deliveryEnabled).toBeUndefined(); expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('saves a ciornă and previews it while reporting readiness blockers', async () => {
    const save = await POST(req({ action: 'save', data: { name: 'Test', subject: 'Subiect', body: 'Mesaj', category: '', city: '' } })); expect(save.status).toBe(200);
    const { result: campaign } = await save.json();
    const preview = await POST(req({ action: 'preview', id: campaign.id })); expect(preview.status).toBe(200);
    const { result } = await preview.json(); expect(result.eligible).toBe(0); expect(result.blockers.length).toBeGreaterThan(0);
    expect((await POST(req({ action: 'state', data: { id: campaign.id, version: campaign.version, state: 'ready' } }))).status).toBe(400);
  });
});
