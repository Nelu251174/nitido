import Database from 'better-sqlite3';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { migratePro } from './schema';
import * as pro from './core';
import { portfolioReport } from './portfolioReport';
import { proReportPeriod } from './reportPeriod';

let db: Database.Database, org: string, a: string, b: string, other: string;
const owner = { id: 'owner' }, admin = { id: 'staff', admin: true }, viewer = { id: 'viewer' };
const interval = { from: '2027-01-01', to: '2027-01-31' };
function member(id: string, role: string, scope: string[]) {
  db.prepare('INSERT INTO pro_members VALUES(?,?,?,?,?,1)').run(crypto.randomUUID(), org, id, role, JSON.stringify(scope));
}
function work(id: string, prop = a, starts = '2027-01-15T10:00:00Z', status = 'scheduled', final: number | null = null, organization = org) {
  db.prepare(`INSERT INTO pro_work_orders(id,organization_id,property_id,title,service,status,starts_at,ends_at,threshold_snapshot,estimate,final_cost,financial_status,checklist_json,created_by,created_at)
    VALUES(?,?,?,?,'cleaning_recurring',?,?,?,1000,500,?,'not_required','["Private checklist"]','owner','2026-12-01T00:00:00Z')`).run(id, organization, prop, id, status, starts, '2027-02-01T11:00:00Z', final);
}
function cost(id: string, prop: string | null = a, stamp = '2027-01-15T10:00:00Z', amount = 500, w: string | null = null, organization = org) {
  db.prepare(`INSERT INTO pro_cost_entries(id,organization_id,property_id,work_order_id,category,amount,created_at) VALUES(?,?,?,?,'cleaning_recurring',?,?)`).run(id, organization, prop, w, amount, stamp);
}
function recurring(prop = a) {
  return pro.createRecurring(db, owner, { property_id: prop, title: 'Daily', service: 'cleaning_recurring', frequency: 'daily', start_date: '2027-02-01', hour: 12, duration: 60, estimate: 0 }).id;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
  db = new Database(':memory:'); db.pragma('foreign_keys=ON');
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT); INSERT INTO users VALUES('owner','Owner','owner@test.ro'),('viewer','Viewer','viewer@test.ro'),('manager','Manager','manager@test.ro'),('approver','Approver','approver@test.ro'),('other','Other','other@test.ro')");
  migratePro(db);
  org = pro.createOrg(db, admin, { name: 'Portfolio', city: 'Iași', owner_id: 'owner', contract_ref: 'test' }).id;
  a = pro.createProperty(db, owner, { organization_id: org, name: 'A', city: 'Iași', address: 'PRIVATE A' }).id;
  b = pro.createProperty(db, owner, { organization_id: org, name: 'B', city: 'Iași', address: 'PRIVATE B' }).id;
  const foreign = pro.createOrg(db, admin, { name: 'Foreign', city: 'Iași', owner_id: 'other', contract_ref: 'foreign' }).id;
  other = pro.createProperty(db, { id: 'other' }, { organization_id: foreign, name: 'Foreign', city: 'Iași', address: 'PRIVATE FOREIGN' }).id;
  db.exec("UPDATE pro_organizations SET status='active'");
});
afterEach(() => { db.close(); vi.useRealTimers(); });

it('defines separate cohorts and counts each work once despite repeated or skipped occurrences', () => {
  work('done', a, undefined, 'completed', 500); work('scheduled'); work('cancel', b, undefined, 'cancelled'); work('outside', a, '2027-02-01T10:00:00Z');
  const rule = recurring();
  db.prepare("INSERT INTO pro_occurrences VALUES(?,?,?,'generated')").run(rule, '2027-01-15', 'done');
  db.prepare("INSERT INTO pro_occurrences VALUES(?,?,?,'generated')").run(rule, '2027-01-16', 'done');
  db.prepare("INSERT INTO pro_occurrences VALUES(?,?,NULL,'skipped')").run(rule, '2027-01-17');
  db.prepare("INSERT INTO pro_occurrences VALUES(?,?,NULL,'missed')").run(rule, '2027-01-18');
  db.prepare("INSERT INTO pro_approvals(id,organization_id,work_order_id,quote_version,amount,requested_by,decision,created_at) VALUES('old',?,'scheduled',1,500,'owner','superseded','2026-12-01'),('current',?,'scheduled',2,600,'owner','pending','2026-12-02')").run(org, org);
  db.prepare("UPDATE pro_work_orders SET quote_version=2 WHERE id='scheduled'").run();
  cost('record', a, '2027-01-31T22:30:00Z', 500, 'done'); // February in Romania, outside registry cohort.
  const result = portfolioReport(db, owner, org, interval);
  expect(result.work).toMatchObject({ total: 3, completed: 1, cancelled: 1, scheduled: 1, recurring: 1 });
  expect(result.approvals).toMatchObject({ current: 1, pending: 1 });
  expect(result.recurrence).toMatchObject({ workOrders: 1, occurrences: { total: 4, generated: 2, skipped: 1, missed: 1 }, rules: { total: 1, active: 1 } });
  expect(result.clientCosts?.registry).toMatchObject({ entries: 0, totalBani: 0 });
  expect(result.clientCosts?.completedWork).toMatchObject({ completed: 1, totalBani: 500, missingRegistry: 0 });
  expect(result.cohorts).toMatchObject({ work: 'starts_at', costs: 'registry_created_at', occurrences: 'nominal_local_day' });
});
it('isolates organization/property scopes before aggregating and paginating', () => {
  member('viewer', 'viewer', [b]); work('hidden-a'); work('visible-b', b);
  const result = portfolioReport(db, viewer, org, interval);
  expect(result.properties.total).toBe(1); expect(result.work.total).toBe(1); expect(result.propertyRows.map(p => p.id)).toEqual([b]);
  expect(result.clientCosts).toBeNull(); expect(result.propertyRows[0].clientCosts).toBeNull();
  expect(result).not.toHaveProperty('internalMargin'); expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(() => portfolioReport(db, viewer, org, { ...interval, property: a })).toThrow('Proprietate');
  expect(() => portfolioReport(db, owner, org, { ...interval, property: other })).toThrow('Proprietate');
  expect(() => portfolioReport(db, { id: 'other' }, org, interval)).toThrow('Acces interzis');
  db.prepare("UPDATE pro_members SET active=0 WHERE user_id='viewer'").run();
  expect(() => portfolioReport(db, viewer, org, interval)).toThrow('Acces interzis');
});
it('keeps financial property scope separate when the same user has viewer and manager memberships', () => {
  member('manager', 'viewer', [a]); member('manager', 'manager', [b]);
  work('one', a, undefined, 'completed', 1000); work('two', b, undefined, 'completed', 500);
  cost('a-cost', a, undefined, 1000); cost('b-cost', b, undefined, 500); cost('org-cost', null, undefined, 9000);
  const result = portfolioReport(db, { id: 'manager' }, org, interval);
  expect(result.work.completed).toBe(2); expect(result.clientCosts?.scope).toEqual({ properties: 1, organizationEntries: false });
  expect(result.clientCosts?.registry.totalBani).toBe(500); expect(result.clientCosts?.completedWork.totalBani).toBe(500);
  expect(result.propertyRows.find(p => p.id === a)?.clientCosts).toBeNull();
  expect(result.propertyRows.find(p => p.id === b)?.clientCosts?.totalBani).toBe(500);
  expect(portfolioReport(db, { id: 'manager' }, org, { ...interval, property: a }).clientCosts).toBeNull();
});
it.each(['viewer', 'approver', 'contact'])('does not grant financial aggregates or internal margin to Pro %s', role => {
  member('viewer', role, []); work('done', a, undefined, 'completed', 500); cost('known', a, undefined, 500, 'done');
  const report = portfolioReport(db, viewer, org, interval);
  expect(report.work.completed).toBe(1); expect(report.clientCosts).toBeNull(); expect(report).not.toHaveProperty('internalMargin');
  expect(report.propertyRows.every(p => p.clientCosts === null)).toBe(true);
});
it.each(['operator', 'manager', 'finance', 'super_admin'] as const)('separates internal %s operational aggregates from financial visibility', internalRole => {
  work('done', a, undefined, 'completed', 500); cost('known', a, undefined, 500, 'done');
  const report = portfolioReport(db, { ...admin, internalRole }, org, interval);
  expect(report.work.completed).toBe(1); expect(JSON.stringify(report)).not.toContain('PRIVATE');
  if (internalRole === 'operator') { expect(report.clientCosts).toBeNull(); expect(report).not.toHaveProperty('internalMargin'); }
  else { expect(report.clientCosts?.registry.totalBani).toBe(500); expect(report.internalMargin).toMatchObject({ available: false, totalBani: null }); }
});
it('does not turn missing final costs, invalid registry amounts or undated records into complete zero totals', () => {
  work('missing', a, undefined, 'completed'); cost('negative', a, undefined, -5); cost('undated', b, 'not-a-date', 1000);
  const report = portfolioReport(db, owner, org, interval);
  expect(report.clientCosts?.completedWork).toMatchObject({ knownBani: 0, totalBani: null, unknownWorks: 1, missingRegistry: 1, complete: false });
  expect(report.clientCosts?.registry).toMatchObject({ knownBani: 0, totalBani: null, unknownEntries: 1, complete: false });
  expect(report.completeness.unknownCostDates).toBe(1);
  expect(report.propertyRows.find(p => p.id === b)?.clientCosts).toMatchObject({ totalBani: null, unknownDates: 1 });
});
it('aggregates all authorized records rather than the existing work-list/export display caps', () => {
  db.transaction(() => { for (let i = 0; i < 1050; i++) { work('w' + i, a, undefined, 'completed', 1); cost('c' + i, a, undefined, 1, 'w' + i); } })();
  const report = portfolioReport(db, owner, org, interval);
  expect(report.work.total).toBe(1050); expect(report.clientCosts?.registry).toMatchObject({ entries: 1050, totalBani: 1050 });
  expect(() => pro.collection(db, owner, org, 'costs', interval)).toThrow('1.000');
});
it('paginates property rows explicitly while totals continue to cover the full scope', () => {
  db.transaction(() => { for (let i = 0; i < 101; i++) pro.createProperty(db, owner, { organization_id: org, name: 'Property ' + i, city: 'Iași', address: 'Private' }); })();
  const first = portfolioReport(db, owner, org, interval), next = portfolioReport(db, owner, org, { ...interval, property_page: '1' });
  expect(first.properties.total).toBe(103); expect(first.propertyRows).toHaveLength(100); expect(first.pagination.nextPage).toBe(1);
  expect(next.propertyRows).toHaveLength(3); expect(next.pagination.nextPage).toBeNull(); expect(next.properties.total).toBe(103);
  expect(new Set([...first.propertyRows, ...next.propertyRows].map(p => p.id)).size).toBe(103);
});
it.each([{ day: '2027-03-28', hours: 23 }, { day: '2027-10-31', hours: 25 }])('uses complete Romanian DST day $day and matches cost CSV selection', ({ day, hours }) => {
  const period = proReportPeriod(day, day), start = Date.parse(period.startsAt!), end = Date.parse(period.endsBefore!);
  expect((end - start) / 3600000).toBe(hours);
  const stamps = [new Date(start - 1).toISOString(), new Date(start).toISOString(), new Date(end - 1).toISOString(), new Date(end).toISOString()];
  stamps.forEach((stamp, i) => { work('w' + i, a, stamp); cost('c' + i, a, stamp, 100); });
  cost('legacy-day', a, day, 100);
  const report = portfolioReport(db, owner, org, { from: day, to: day });
  expect(report.work.total).toBe(2); expect(report.clientCosts?.registry).toMatchObject({ entries: 3, totalBani: 300 });
  const registry = pro.collection(db, owner, org, 'costs', { from: day, to: day }) as { id: string }[];
  expect(registry.map(c => c.id).sort()).toEqual(['c1', 'c2', 'legacy-day']);
});
it('reports unknown work dates and uses the current Romanian month by default', () => {
  vi.setSystemTime(new Date('2027-01-31T22:30:00Z')); work('feb', a, '2027-02-01T00:00:00Z'); work('bad', a, 'broken');
  const report = portfolioReport(db, owner, org);
  expect(report.period).toMatchObject({ from: '2027-02-01', to: '2027-02-01', timezone: 'Europe/Bucharest' });
  expect(report.work.total).toBe(1); expect(report.completeness.unknownWorkDates).toBe(1);
  expect(report.completeness.workComplete).toBe(false);
});
it('marks required approvals without a current quote as unknown instead of an approved zero', () => {
  work('pending'); db.prepare("UPDATE pro_work_orders SET financial_status='pending' WHERE id='pending'").run();
  const report = portfolioReport(db, owner, org, interval);
  expect(report.approvals).toMatchObject({ current: 0, pending: 0, approved: 0, missingCurrent: 1 });
});
it.each([{ from: '2027-02-30' }, { from: '2027-02-01', to: '2027-01-01' }, { property_page: '-1' }, { category: 'toString' }])('rejects invalid filters %#', filters => {
  expect(() => portfolioReport(db, owner, org, { ...interval, ...filters })).toThrow();
});
