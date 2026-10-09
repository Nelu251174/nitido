import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { initializeDatabase } from '@/lib/db';
import { createAssessment } from '@/lib/assessments';
import { hasAdminPermission, type AdminRole, type AdminPermission } from '@/lib/adminRolesShared';
const state = vi.hoisted(() => ({ db: null as unknown as Database.Database, role: 'operator' as AdminRole | null, audit: vi.fn() }));
vi.mock('@/lib/db', async original => ({ ...await original<typeof import('@/lib/db')>(), get db() { return state.db; } }));
vi.mock('@/lib/adminAuth', () => ({ getAdminActorId: async (permission: AdminPermission) => state.role && hasAdminPermission(state.role, permission) ? 'verified-operator' : null, auditAdminAction: state.audit }));
import { GET, POST } from './route';
let id: string;
const read = (query = 'id=' + id) => GET(new NextRequest('http://localhost/api/admin/assessment-qualification?' + query));
const write = (body: unknown, origin = 'http://localhost') => POST(new NextRequest('http://localhost/api/admin/assessment-qualification', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }));
const body = () => ({ id, revision: 0, assessmentVersion: 1, reason: 'TEST pending check', actor: 'forged', outcome: 'ready' });
beforeEach(() => {
  state.db = new Database(':memory:'); state.db.pragma('foreign_keys=ON'); initializeDatabase(state.db); state.db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client')");
  id = createAssessment(state.db, 'c', 'request', { category: 'maintenance', city: 'București', sqm: 80, rooms: 2, bathrooms: 1, difficulty: 'normal', notes: 'TEST request', appliances: 0, windowsSqm: 0, linenSets: 0, extraHours: 0 }); state.role = 'operator'; state.audit.mockReset();
});
afterEach(() => state.db.close());
it('allows operational roles, rejects Finance/missing sessions, and returns private uncached reads', async () => {
  expect((await read()).headers.get('Cache-Control')).toBe('private, no-store'); expect((await read()).status).toBe(200);
  state.role = 'manager'; expect((await read()).status).toBe(200); state.role = 'finance'; expect((await read()).status).toBe(401); expect((await write(body())).status).toBe(401); state.role = null; expect((await read()).status).toBe(401);
});
it('computes outcome on server, uses nominal author and prevents conflicting duplicate writes', async () => {
  const response = await write(body()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ state: 'pending', revision: 1, last: { actor_id: 'verified-operator' } });
  expect(state.audit).toHaveBeenCalledWith('assessment.qualification_checked', id, expect.objectContaining({ actorId: 'verified-operator', outcome: 'pending', criteriaVersion: 1 })); expect((await write(body())).status).toBe(409);
});
it('rolls back the verification when audit fails and rejects cross-origin, invalid bodies and oversized data', async () => {
  state.audit.mockImplementation(() => { throw Error('Audit unavailable'); }); expect((await write(body())).status).toBe(503); expect(state.db.prepare('SELECT COUNT(*) n FROM assessment_qualification_events WHERE assessment_id=?').get(id)).toEqual({ n: 1 });
  expect((await write(body(), 'https://foreign.test')).status).toBe(403); expect((await write([])).status).toBe(400); expect((await write('x'.repeat(10001))).status).toBe(413);
});
it('validates cohort and pagination queries rather than silently truncating or substituting filters', async () => {
  expect((await read('id=' + id + '&before=-1')).status).toBe(400); expect((await read('from=2026-02-30&to=2026-03-01')).status).toBe(400); expect((await read('from=2026-01-01&to=2026-12-31&category=unknown')).status).toBe(400);
});
