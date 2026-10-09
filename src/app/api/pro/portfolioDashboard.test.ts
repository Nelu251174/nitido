import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { migratePro } from '@/lib/pro/schema';
import * as pro from '@/lib/pro/core';
import type { AdminRole } from '@/lib/adminRolesShared';
const state = vi.hoisted(() => ({ db: null as unknown as Database.Database, role: null as AdminRole | null, user: 'owner' as string | null }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => state.user ? { id: state.user } : null }));
vi.mock('@/lib/adminAuth', () => ({ getAdminIdentity: async () => state.role ? { id: 'staff', role: state.role, revision: 1 } : null }));
vi.mock('@/lib/email', () => ({ emailConfigured: () => false, sendEmail: vi.fn() }));
vi.mock('@/lib/emailVerification', () => ({ emailIsVerified: () => true }));
import { GET, POST } from './[...path]/route';
let org: string, a: string, b: string;
const read = (kind = 'dashboard', query = '') => GET(new NextRequest('http://localhost/api/pro/' + kind + '?organization_id=' + org + '&from=2027-03-28&to=2027-03-28' + query), { params: Promise.resolve({ path: kind.split('/') }) });
beforeEach(() => {
  state.db = new Database(':memory:'); state.db.pragma('foreign_keys=ON');
  state.db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT); INSERT INTO users VALUES('owner','Owner','owner@test.ro'),('viewer','Viewer','viewer@test.ro')"); migratePro(state.db);
  org = pro.createOrg(state.db, { id: 'staff', admin: true }, { name: 'Portfolio', city: 'Iași', owner_id: 'owner', contract_ref: 'PRIVATE CONTRACT' }).id;
  a = pro.createProperty(state.db, { id: 'owner' }, { organization_id: org, name: 'A', city: 'Iași', address: 'PRIVATE ADDRESS', instructions: 'PRIVATE INSTRUCTIONS' }).id;
  b = pro.createProperty(state.db, { id: 'owner' }, { organization_id: org, name: 'B', city: 'Iași', address: 'PRIVATE B' }).id;
  state.db.prepare("INSERT INTO pro_members VALUES('viewer',?,'viewer','viewer',?,1)").run(org, JSON.stringify([b]));
  state.db.prepare("INSERT INTO pro_cost_entries(id,organization_id,property_id,category,amount,created_at) VALUES('in',?,?,'cleaning_recurring',77777,'2027-03-27T22:00:00Z'),('out',?,?,'cleaning_recurring',88888,'2027-03-28T21:00:00Z')").run(org, a, org, b);
  state.user = 'owner'; state.role = null; vi.stubEnv('NITIDO_PRO_ENABLED', 'true');
});
afterEach(() => { state.db.close(); vi.unstubAllEnvs(); });
it('uses private no-store and the same Romanian date boundaries as the existing CSV endpoint', async () => {
  const response = await read(); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  const dashboard = await response.json(); expect(dashboard.clientCosts.registry).toMatchObject({ entries: 1, totalBani: 77777 });
  expect(dashboard).not.toHaveProperty('internalMargin'); expect(JSON.stringify(dashboard)).not.toContain('PRIVATE');
  const csv = await read('reports/export'); expect(csv.status).toBe(200); const body = await csv.text(); expect(body).toContain('777.77'); expect(body).not.toContain('888.88');
});
it('limits Viewer aggregates to authorized properties without financial totals or CSV permissions', async () => {
  state.user = 'viewer'; const report = await (await read()).json();
  expect(report.properties.total).toBe(1); expect(report.propertyRows.map((r: { id: string }) => r.id)).toEqual([b]); expect(report.clientCosts).toBeNull();
  expect((await read('reports/export')).status).toBe(404); expect((await read('dashboard', '&property=' + a)).status).toBe(404);
});
it.each(['operator', 'manager', 'finance', 'super_admin'] as const)('enforces internal %s report grants before returning any aggregate', async role => {
  state.user = null; state.role = role;
  const response = await read(); expect(response.status).toBe(200); const report = await response.json(); expect(JSON.stringify(report)).not.toContain('PRIVATE');
  if (role === 'operator') { expect(report.clientCosts).toBeNull(); expect(report).not.toHaveProperty('internalMargin'); expect((await read('reports/export')).status).toBe(403); }
  else { expect(report.clientCosts.registry.totalBani).toBe(77777); expect(report.internalMargin).toMatchObject({ available: false, totalBani: null }); }
});
it('fails closed for logged-out/revoked identities, invalid dates, unknown property scopes and dashboard mutations', async () => {
  state.user = null; expect((await read()).status).toBe(401);
  state.user = 'viewer'; state.db.prepare("UPDATE pro_members SET active=0 WHERE user_id='viewer'").run(); expect((await read()).status).toBe(404);
  state.user = 'owner'; expect((await read('dashboard', '&property=missing')).status).toBe(404);
  const invalid = await GET(new NextRequest('http://localhost/api/pro/dashboard?organization_id=' + org + '&from=2027-02-30'), { params: Promise.resolve({ path: ['dashboard'] }) }); expect(invalid.status).toBe(422);
  state.user = null; state.role = 'manager';
  expect((await POST(new NextRequest('http://localhost/api/pro/dashboard', { method: 'POST', headers: { origin: 'http://localhost', 'idempotency-key': crypto.randomUUID() }, body: '{}' }), { params: Promise.resolve({ path: ['dashboard'] }) })).status).toBe(403);
});
