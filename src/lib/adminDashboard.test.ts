import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Database from 'better-sqlite3';
import {adminDashboard} from './adminDashboard';
import {adminFirms, adminWorkbench} from './adminWorkbench';

let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);
    CREATE TABLE firms(id TEXT PRIMARY KEY,user_id TEXT,coverage_city TEXT,cui TEXT,verified INTEGER,
      rating_sum INTEGER DEFAULT 0,rating_count INTEGER DEFAULT 0,strikes_30d INTEGER DEFAULT 0,
      strikes_90d INTEGER DEFAULT 0,suspended_until TEXT);
    CREATE TABLE jobs(id TEXT PRIMARY KEY,client_id TEXT,city TEXT DEFAULT 'București',street TEXT DEFAULT 'Private street',
      sqm INTEGER DEFAULT 70,duration_minutes INTEGER DEFAULT 120,status TEXT DEFAULT 'waiting',
      scheduled_at TEXT,accepted_firm_id TEXT,created_at TEXT DEFAULT '2026-01-01T00:00:00Z',
      accepted_at TEXT,arrived_confirmed_at TEXT,completed_at TEXT);
    CREATE TABLE offers(job_id TEXT,status TEXT);
    CREATE TABLE workspace_assignments(job_id TEXT,team_id TEXT);
    CREATE TABLE workspace_teams(id TEXT,active INTEGER);
    CREATE TABLE appointment_acknowledgments(job_id TEXT,firm_id TEXT,scheduled_at TEXT);
    CREATE TABLE visit_cases(id TEXT,job_id TEXT,created_at TEXT,status TEXT);
    CREATE TABLE service_assessments(id TEXT,status TEXT);
    CREATE TABLE extra_work_requests(id TEXT,job_id TEXT,assessment_id TEXT,created_at TEXT,status TEXT);
    CREATE TABLE notification_outbox(status TEXT);
    CREATE TABLE appointment_reminders(status TEXT);
    CREATE TABLE payments(id TEXT,job_id TEXT,status TEXT,amount_gross INTEGER,refund_status TEXT DEFAULT 'none',
      transfer_status TEXT DEFAULT 'not_started',payout_status TEXT DEFAULT 'unknown',dispute_status TEXT DEFAULT 'none',stripe_payment_intent_id TEXT);
    CREATE TABLE payment_refunds(payment_id TEXT,stripe_refund_id TEXT);
    INSERT INTO users VALUES('client','Client Test'),('provider','Firma Test');
    INSERT INTO firms(id,user_id,coverage_city,cui,verified) VALUES('firm','provider','București','RO123',1);
  `);
});
afterEach(() => {db.close(); vi.unstubAllEnvs();});
function job(id: string, scheduled: string | null, status = 'waiting') {
  db.prepare('INSERT INTO jobs(id,client_id,scheduled_at,status) VALUES(?,?,?,?)').run(id, 'client', scheduled, status);
}
const params = (query = '') => new URLSearchParams(query);

describe('ADMIN dashboard read-only snapshot', () => {
  it('counts scheduled Romanian civil days instead of creation dates or the host day', () => {
    job('before', '2026-10-31T21:59:59Z', 'completed');
    job('start', '2026-10-31T22:00:00Z', 'completed');
    job('end', '2026-11-01T21:59:59Z', 'completed');
    job('next', '2026-11-01T22:00:00Z', 'completed');
    job('cancelled', '2026-11-01T10:00:00Z', 'cancelled');
    job('missed', '2026-11-01T11:00:00Z', 'no_show');
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
      vi.stubEnv('TZ', tz);
      const result = adminDashboard(db, 'super_admin', new Date('2026-10-31T22:30:00Z'));
      expect(result.date).toBe('2026-11-01');
      expect(result.counts.scheduledToday).toBe(2);
      const linkedList = adminWorkbench(db, 'super_admin', params('date=2026-11-01&scheduled=1'));
      expect(linkedList.total).toBe(result.counts.scheduledToday);
      expect(linkedList.jobs.map(j => j.id).sort()).toEqual(['end', 'start']);
      expect(result.schedule.jobs.map(j => j.id)).toEqual(['start', 'end']);
      expect(result.timezone).toBe('Europe/Bucharest');
    }
  });

  it.each([
    ['2026-03-29T08:00:00Z', '2026-03-28T22:00:00Z', '2026-03-29T21:00:00Z'],
    ['2026-10-25T08:00:00Z', '2026-10-24T21:00:00Z', '2026-10-25T22:00:00Z'],
  ])('handles the 23/25-hour Romanian day at %s', (now, start, end) => {
    job('before', new Date(Date.parse(start) - 1000).toISOString(), 'completed');
    job('start', start, 'completed');
    job('last', new Date(Date.parse(end) - 1000).toISOString(), 'completed');
    job('next', end, 'completed');
    expect(adminDashboard(db, 'operator', new Date(now)).schedule.jobs.map(j => j.id)).toEqual(['start', 'last']);
  });

  it('counts a job once while retaining each reason and its contextual destination', () => {
    job('overdue', '2026-10-31T08:00:00Z');
    db.exec("INSERT INTO visit_cases VALUES('case','overdue','2026-10-31T07:00:00Z','open');INSERT INTO notification_outbox VALUES('failed');");
    const result = adminDashboard(db, 'operator', new Date('2026-10-31T10:00:00Z'));
    expect(result.counts).toMatchObject({urgent: 1, attention: 1, financialIssues: null});
    expect(result.attention.total).toBe(2);
    const dossier = result.attention.items.find(i => i.jobId === 'overdue')!;
    expect(dossier.reasons).toHaveLength(3);
    expect(dossier.reasons.map(i => i.href)).toContain('/admin/suport?tab=incidente&jobId=overdue');
    expect(dossier.reasons.map(i => i.href)).toContain('/admin/lucrari?jobId=overdue');
    expect(result.attention.items.find(i => i.key === 'notifications')?.href).toBe('/admin/suport?tab=notificari');
    expect(result.attention.limits).toContain('1.000');
  });

  it('caps the visible schedule and queue without reporting the visible rows as the total', () => {
    for (let i = 0; i < 24; i++) job('job' + i, '2026-10-31T09:00:00Z');
    const result = adminDashboard(db, 'super_admin', new Date('2026-10-31T10:00:00Z'));
    expect(result.counts.urgent).toBe(24);
    expect(result.counts.scheduledToday).toBe(24);
    expect(result.attention.total).toBe(24);
    expect(result.attention.items).toHaveLength(20);
    expect(result.schedule.total).toBe(24);
    expect(result.schedule.jobs).toHaveLength(20);
    const all = adminDashboard(db, 'super_admin', new Date('2026-10-31T10:00:00Z'), true);
    expect(all.attention.items).toHaveLength(24);
    expect(all.attention.total).toBe(24);
    expect(all.attention.limits).not.toContain('primele 20');
    expect(all.schedule.jobs).toHaveLength(20);
  });

  it('does not expose private addresses or payment exception counts outside the existing roles', () => {
    job('job', '2026-10-31T09:00:00Z');
    db.exec(`INSERT INTO payments(id,job_id,amount_gross,transfer_status,refund_status) VALUES('p','job',990,'failed','pending');
      INSERT INTO payments(id,job_id,amount_gross) VALUES('normal','job',990);`);
    for (const role of ['operator', 'manager'] as const) {
      const result = adminDashboard(db, role, new Date('2026-10-31T10:00:00Z'));
      expect(result.counts.financialIssues).toBeNull();
      expect(JSON.stringify(result)).not.toContain('Private street');
    }
    const owner = adminDashboard(db, 'super_admin', new Date('2026-10-31T10:00:00Z'));
    expect(owner.counts.financialIssues).toBe(1);
    expect(owner.schedule.jobs[0].street).toBe('Private street');
    expect(() => adminDashboard(db, 'finance')).toThrow(/operațional/);
    expect(db.prepare('SELECT transfer_status,refund_status FROM payments WHERE id=?').get('p')).toEqual({transfer_status: 'failed', refund_status: 'pending'});
  });
});

describe('ADMIN directories', () => {
  it('searches and filters the whole workbench before pagination, retaining job context', () => {
    for (let i = 0; i < 53; i++) job('job' + i, '2026-10-31T10:00:00Z', 'completed');
    job('selected', '2026-10-31T22:00:00Z', 'accepted');
    db.exec("UPDATE jobs SET city='Constanța',accepted_firm_id='firm' WHERE id='selected'");
    expect(adminWorkbench(db, 'operator', params()).jobs).toHaveLength(50);
    const result = adminWorkbench(db, 'operator', params('q=Firma&status=accepted&city=Constan%C8%9Ba&date=2026-11-01'));
    expect(result.total).toBe(1);
    expect(result.jobs[0]).toMatchObject({id: 'selected', client_name: 'Client Test', firm_name: 'Firma Test', street: null});
    expect(result.jobs[0]).not.toHaveProperty('payments');
    expect(adminWorkbench(db, 'operator', params('jobId=selected')).jobs).toHaveLength(1);
  });

  it('keeps literal wildcard searches literal and rejects invalid query values', () => {
    job('job', null);
    expect(adminWorkbench(db, 'operator', params('q=%25')).jobs).toEqual([]);
    for (const query of ['offset=-1', 'offset=NaN', 'status=unknown', 'scheduled=maybe', 'date=2026-02-31', 'jobId=..%2Finvalid', 'q=' + 'x'.repeat(151)]) {
      expect(() => adminWorkbench(db, 'operator', params(query))).toThrow();
    }
  });

  it('returns payment references only to financial roles while keeping private street restricted', () => {
    job('job', null);
    db.exec("INSERT INTO payments(id,job_id,amount_gross,stripe_payment_intent_id) VALUES('p','job',990,'pi_private')");
    for (const role of ['operator', 'manager'] as const) {
      expect(JSON.stringify(adminWorkbench(db, role, params()))).not.toMatch(/pi_private|Private street|990/);
    }
    for (const role of ['operator', 'manager', 'finance'] as const) {
      expect(adminWorkbench(db, role, params('q=Private%20street')).total).toBe(0);
    }
    expect(adminWorkbench(db, 'super_admin', params('q=Private%20street')).total).toBe(1);
    expect(JSON.stringify(adminWorkbench(db, 'finance', params()))).toContain('pi_private');
    expect(JSON.stringify(adminWorkbench(db, 'finance', params()))).not.toContain('Private street');
    expect(JSON.stringify(adminWorkbench(db, 'super_admin', params()))).toContain('Private street');
  });

  it('paginates and narrows firms without exposing credentials or private user fields', () => {
    expect(adminFirms(db, params('q=RO123&verified=1')).firms).toHaveLength(1);
    expect(adminFirms(db, params('verified=0')).total).toBe(0);
    expect(adminFirms(db, params('city=Constan%C8%9Ba')).total).toBe(0);
    expect(() => adminFirms(db, params('verified=true'))).toThrow();
    expect(() => adminFirms(db, params('offset=-1'))).toThrow();
  });
});
