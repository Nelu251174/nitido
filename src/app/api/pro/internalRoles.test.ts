import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { migratePro } from '@/lib/pro/schema';
import * as pro from '@/lib/pro/core';
import type { AdminRole } from '@/lib/adminRolesShared';
const state = vi.hoisted(() => ({ db: null as unknown as Database.Database, role: 'operator' as AdminRole | null }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => null }));
vi.mock('@/lib/adminAuth', () => ({ getAdminIdentity: async () => state.role ? { id: 'nominal-staff', role: state.role, revision: 1, email: 'staff@test.ro' } : null }));
vi.mock('@/lib/email', () => ({ emailConfigured: () => false, sendEmail: vi.fn() }));
vi.mock('@/lib/emailVerification', () => ({ emailIsVerified: () => true }));
import { GET, POST } from './[...path]/route';
let org: string, property: string, work: string;
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('?')[0].split('/') }) });
const read = (path: string) => GET(new NextRequest('http://localhost/api/pro/' + path), context(path));
const write = (path: string, body: object, key = crypto.randomUUID(), origin = 'http://localhost') => POST(new NextRequest('http://localhost/api/pro/' + path, { method: 'POST', headers: { origin, 'idempotency-key': key }, body: JSON.stringify(body) }), context(path));
beforeEach(() => {
  state.db = new Database(':memory:'); state.db.pragma('foreign_keys=ON');
  state.db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT); INSERT INTO users VALUES('owner','Owner','owner@test.ro','client');"); migratePro(state.db);
  const principal = { id: 'root', admin: true };
  org = pro.createOrg(state.db, principal, { name: 'Portfolio', city: 'București', owner_id: 'owner', contract_ref: 'contract-private' }).id;
  property = pro.createProperty(state.db, principal, { organization_id: org, name: 'Unit', city: 'București', address: 'PRIVATE_ADDRESS', instructions: 'PRIVATE_ACCESS' }).id;
  state.db.prepare("UPDATE pro_organizations SET status='active' WHERE id=?").run(org);
  work = pro.createWork(state.db, principal, { property_id: property, title: 'Cleaning', service: 'cleaning_recurring', starts_at: '2099-01-15T10:00:00Z', ends_at: '2099-01-15T11:00:00Z', estimate: 50000 }).id;
  state.role = 'operator'; vi.stubEnv('NITIDO_PRO_ENABLED', 'true');
});
afterEach(() => { state.db.close(); vi.unstubAllEnvs(); });
it('returns nominal identity and redacts Operator money in context, work, nested approvals and recurrence', async () => {
  const ctx = await (await read('context')).json(); expect(ctx.user_id).toBe('nominal-staff'); expect(ctx.internal_role).toBe('operator'); expect(ctx.internal_permissions.manage).toBe(false); expect(ctx.organizations[0]).not.toHaveProperty('threshold');
  const data = await (await read('work-orders/' + work)).json(); expect(data).not.toHaveProperty('estimate'); expect(data).not.toHaveProperty('threshold_snapshot'); expect(data.property.address).toBe('PRIVATE_ADDRESS'); expect(data.approvals.every((a: object) => !('amount' in a))).toBe(true); expect(data.permissions).toMatchObject({ manage: false, operator: true, approve: false });
  expect((await read('costs?organization_id=' + org)).status).toBe(403); expect((await read('reports/export?organization_id=' + org)).status).toBe(403);
});
it('rejects privilege escalation and role-inappropriate writes before idempotency replay', async () => {
  const key = crypto.randomUUID(), body = { property_id: property, title: 'Additional', service: 'cleaning_recurring', starts_at: '2099-01-16T10:00:00Z', ends_at: '2099-01-16T11:00:00Z', estimate: 20000 };
  state.role = 'manager'; expect((await write('work-orders', body, key)).status).toBe(200);
  state.role = 'operator'; expect((await write('work-orders', body, key)).status).toBe(403);
  for (const path of ['organizations', 'activate/' + org, 'staff/' + org, 'settings/' + org, 'approvals/fake', 'work-orders/' + work + '/quote']) expect((await write(path, {})).status).toBe(403);
});
it('delegates the existing ticket transition used by the interface to Operator', async () => {
  const created = await write('tickets', { property_id: property, title: 'Access issue', description: 'Arrange entry', priority: 'normal' });
  expect(created.status).toBe(200); const { id } = await created.json();
  expect((await write('tickets/' + id + '/transition', { status: 'triaged', note: 'Checked' })).status).toBe(200);
  expect(state.db.prepare('SELECT status FROM pro_tickets WHERE id=?').get(id)).toEqual({ status: 'triaged' });
  expect((await write('tickets/' + id + '/create-work', {})).status).toBe(403);
});
it('supports Manager operations with a nominal atomic audit and rolls back on audit failure', async () => {
  state.role = 'manager'; const response = await write('work-orders/' + work + '/quote', { revision: 1, amount: 60000, note: 'Revised scope' }); expect(response.status).toBe(200);
  expect(state.db.prepare("SELECT actor FROM pro_audit_logs WHERE entity_id=? AND action='work.quote'").get(work)).toEqual({ actor: 'nominal-staff' });
  state.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON pro_audit_logs WHEN NEW.action='work.quote' BEGIN SELECT RAISE(ABORT,'audit failed'); END;");
  expect((await write('work-orders/' + work + '/quote', { revision: 2, amount: 70000, note: 'Should rollback' })).status).toBe(503);
  expect(state.db.prepare('SELECT estimate,revision FROM pro_work_orders WHERE id=?').get(work)).toEqual({ estimate: 60000, revision: 2 });
});
it('limits Finance to financial reads and existing external cost recording', async () => {
  state.role = 'finance'; const data = await (await read('work-orders/' + work)).json(); expect(data.estimate).toBe(50000); expect(data.property).toEqual({ name: 'Unit', city: 'București' }); expect(data).not.toHaveProperty('media'); expect(data.permissions).toMatchObject({ manage: false, operator: false, approve: false });
  const detail = await (await read('properties/' + property)).json(); expect(detail).not.toHaveProperty('address'); expect(detail).not.toHaveProperty('instructions'); expect(detail).not.toHaveProperty('checklist_configuration');
  for (const path of ['work-orders/' + work + '/credential', 'media/fake', 'tickets', 'recurring?organization_id=' + org]) expect((await read(path)).status).toBe(403);
  for (const path of ['work-orders', 'work-orders/' + work + '/rework', 'partners', 'recurring']) expect((await write(path, {})).status).toBe(403);
  state.db.prepare("INSERT INTO pro_cost_entries(id,organization_id,property_id,work_order_id,category,amount,created_at) VALUES('cost',?,?,?,'cleaning',50000,'2026-10-09')").run(org, property, work);
  expect((await write('costs/cost', { status: 'invoiced_external', invoice_ref: 'invoice-test' })).status).toBe(200);
  expect(state.db.prepare('SELECT invoice_ref FROM pro_cost_entries WHERE id=?').get('cost')).toEqual({ invoice_ref: 'invoice-test' });
});
it('fails closed on missing/revoked sessions, unclassified paths and cross-origin mutations', async () => {
  state.role = null; expect((await read('context')).status).toBe(401); expect((await write('work-orders', {})).status).toBe(401);
  state.role = 'manager'; expect((await read('unknown?organization_id=' + org)).status).toBe(403); expect((await write('work-orders', {}, crypto.randomUUID(), 'https://foreign.test')).status).toBe(403);
});
it('creates, pauses and resumes daily rules through the delegated adapter without activating the legacy recurrence', async () => {
  state.role = 'manager';
  const created = await write('recurring', { property_id: property, title: 'Daily', service: 'cleaning_recurring', frequency: 'daily', start_date: '2099-02-01', end_date: '2099-02-03', hour: 10, duration: 60, estimate: 50000 });
  expect(created.status).toBe(200); const { id } = await created.json();
  for (const active of [false, true]) {
    expect((await write('recurring/' + id, { active })).status).toBe(200);
    const rules = await (await read('recurring?organization_id=' + org)).json();
    expect(rules.find((rule: { id: string }) => rule.id === id)).toMatchObject({ frequency: 'daily', active: active ? 1 : 0 });
    expect(state.db.prepare('SELECT frequency,active FROM pro_recurring_rules WHERE id=?').get(id)).toEqual({ frequency: 'weekly', active: 0 });
  }
  state.role = 'operator'; const rules = await (await read('recurring?organization_id=' + org)).json(); expect(rules[0]).not.toHaveProperty('estimate');
  expect((await write('recurring/' + id, { active: false })).status).toBe(403);
  state.role = 'manager';
  expect((await write('properties/' + property + '/update', { name: 'Unit', address: 'Private', status: 'inactive' })).status).toBe(409);
  expect((await write('work-orders/' + work + '/cancel', { revision: 1, note: 'Test cleanup' })).status).toBe(200);
  expect((await write('properties/' + property + '/update', { name: 'Unit', address: 'Private', status: 'inactive' })).status).toBe(200);
  expect(state.db.prepare('SELECT active FROM pro_recurring_cadences WHERE rule_id=?').get(id)).toEqual({ active: 0 });
});
