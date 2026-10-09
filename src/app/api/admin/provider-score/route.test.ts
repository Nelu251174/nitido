import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { hasAdminPermission, type AdminRole, type AdminPermission } from '@/lib/adminRolesShared';
import { PROVIDER_SCORE_SCHEMA } from '@/lib/providerScoreSchema';
const state = vi.hoisted(() => ({ db: null as Database.Database | null, role: 'manager' as AdminRole | null, trusted: true, audit: vi.fn() }));
vi.mock('@/lib/db', () => ({ get db() { return state.db!; } }));
vi.mock('@/lib/adminAuth', () => ({ getAdminActorId: async (permission: AdminPermission) => state.role && hasAdminPermission(state.role, permission) ? 'verified_actor' : null, auditAdminAction: state.audit }));
vi.mock('@/lib/security', () => ({ hasTrustedMutationOrigin: () => state.trusted }));
vi.mock('@/lib/providerScoreReport', () => ({ providerScoreReport: () => ({ policy: null, providers: [], automaticAllocation: false }) }));
import { GET, POST } from './route';
const body = () => ({ revision: 0, reason: 'Regulă de pilot', actor: 'forged', definition: { mode: 'observation', periodDays: 30, minimumCompletedJobs: 5, minimumSamples: 3, weights: { rating: 100, punctuality: 0, reliability: 0, complaintFree: 0, evidence: 0 } } });
const req = (data: unknown) => new NextRequest('https://sandbox.nitido.ro/api/admin/provider-score', { method: 'POST', body: JSON.stringify(data) });
beforeEach(() => { state.db = new Database(':memory:'); state.db.exec(PROVIDER_SCORE_SCHEMA); state.role = 'manager'; state.trusted = true; state.audit.mockReset(); });
afterEach(() => state.db!.close());
it('enforces role matrix and trusted mutation origin', async () => {
  for (const role of [null, 'operator'] as const) { state.role = role; expect((await GET()).status).toBe(401); expect((await POST(req(body()))).status).toBe(401); }
  state.role = 'finance'; expect((await GET()).status).toBe(200); expect((await POST(req(body()))).status).toBe(401);
  state.role = 'manager'; state.trusted = false; expect((await POST(req(body()))).status).toBe(403);
});
it('records authenticated actor, conflicts and private no-store', async () => {
  const response = await POST(req(body())); expect(response.status).toBe(200);
  expect(state.db!.prepare('SELECT actor_id FROM provider_score_policies').get()).toEqual({ actor_id: 'verified_actor' });
  expect((await POST(req(body()))).status).toBe(409); expect((await GET()).headers.get('Cache-Control')).toBe('private, no-store');
});
it('rolls back when audit fails and rejects invalid/oversized activation attempts', async () => {
  state.audit.mockImplementation(() => { throw Error('sensitive failure'); });
  const response = await POST(req(body())); expect(response.status).toBe(500); expect(await response.text()).not.toContain('sensitive'); expect(state.db!.prepare('SELECT COUNT(*) n FROM provider_score_policies').get()).toEqual({ n: 0 });
  state.audit.mockReset(); expect((await POST(req({ ...body(), definition: { ...body().definition, mode: 'active' } }))).status).toBe(400);
  expect((await POST(req('x'.repeat(10001)))).status).toBe(413);
});
