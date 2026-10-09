import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { initializeDatabase } from '@/lib/db';
import type { AdminRole } from '@/lib/adminRolesShared';
const state = vi.hoisted(() => ({ db: null as unknown as Database.Database, role: 'operator' as AdminRole | null, audit: vi.fn() }));
vi.mock('@/lib/db', async original => ({ ...await original<typeof import('@/lib/db')>(), get db() { return state.db; } }));
vi.mock('@/lib/adminAuth', () => ({ getAdminIdentity: async () => state.role ? { id: 'nominal-staff', role: state.role, revision: 1, email: 'staff@test.ro' } : null, auditAdminAction: state.audit }));
import { GET, POST } from './route';
const read = () => GET(new NextRequest('http://localhost/api/admin/customers?clientId=c'));
const write = (body: object, origin = 'http://localhost') => POST(new NextRequest('http://localhost/api/admin/customers', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }));
beforeEach(() => {
  state.db = new Database(':memory:'); state.db.pragma('foreign_keys=ON'); initializeDatabase(state.db);
  state.db.exec("INSERT INTO users(id,role,name,credit_balance) VALUES('c','client','Client',42); INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES('j','c','Private','București',50,'apartament','asap',500,120,'completed'); INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status,stripe_payment_intent_id) VALUES('p','j',500,75,425,'captured','pi_private');");
  state.role = 'operator'; state.audit.mockReset();
});
afterEach(() => state.db.close());
it('gives Operator operational histories without credit, margin, amounts or processor references', async () => {
  const response = await read(), data = await response.json(); expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(data.user.credit_balance).toBeNull(); expect(data.value.margin).toBeNull(); expect(data.value.completedServiceValueBani).toBeNull();
  expect(data.jobs.rows[0]).not.toHaveProperty('price_gross'); expect(data.payments.rows).toEqual([]);
  expect(JSON.stringify(data)).not.toContain('pi_private');
});
it('delegates notes/classification to Operator but restrictions to Manager', async () => {
  expect((await write({ action: 'note', clientId: 'c', note: 'Context', actorId: 'forged' })).status).toBe(200);
  expect(state.db.prepare('SELECT actor_id FROM customer_internal_notes').get()).toEqual({ actor_id: 'nominal-staff' });
  const restriction = { action: 'restrict', clientId: 'c', revision: 0, blockBookings: true, blockAssessments: false, reason: 'Verified abuse' };
  expect((await write(restriction)).status).toBe(403); state.role = 'manager'; expect((await write(restriction)).status).toBe(200);
  expect((await write(restriction)).status).toBe(409); expect(state.audit).toHaveBeenCalledWith('customer.restrict', 'c', expect.objectContaining({ actorId: 'nominal-staff' }));
  const data = await (await read()).json(); expect(data.value.completedServiceValueBani).toBe(50000); expect(data.user.credit_balance).toBeNull(); expect(data.payments.rows).toEqual([]);
});
it('permits Finance financial reads while rejecting every CRM mutation', async () => {
  state.role = 'finance'; const data = await (await read()).json(); expect(data.user.credit_balance).toBe(42); expect(data.payments.rows[0].stripe_payment_intent_id).toBe('pi_private');
  for (const action of ['note', 'classify', 'restrict']) expect((await write({ action, clientId: 'c', note: 'No' })).status).toBe(403);
});
it('fails closed after session revocation and rolls back when audit fails', async () => {
  state.role = null; expect((await read()).status).toBe(401); expect((await write({ action: 'note', clientId: 'c', note: 'No' })).status).toBe(401);
  state.role = 'manager'; state.audit.mockImplementation(() => { throw Error('Audit unavailable'); });
  expect((await write({ action: 'note', clientId: 'c', note: 'Rollback' })).status).toBe(500); expect(state.db.prepare('SELECT * FROM customer_internal_notes').all()).toEqual([]);
  expect((await write({ action: 'note', clientId: 'c', note: 'No' }, 'https://foreign.test')).status).toBe(403);
});
