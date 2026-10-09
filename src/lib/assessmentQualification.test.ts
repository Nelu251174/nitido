import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from './db';
import { createAssessment, updateAssessment } from './assessments';
import { saveAssessmentPlan } from './assessmentPlan';
import { setCatalogFirm } from './catalogCapacity';
import { attachAssessmentPhoto, reviewAssessmentEvidence } from './assessmentEvidence';
import { assessmentQualification, reportQualification, verifyAssessmentQualification } from './assessmentQualification';
let db: Database.Database, id: string;
const now = new Date('2026-10-09T00:00:00Z');
const input = (category = 'maintenance') => ({ category, city: 'București', sqm: 80, rooms: 2, bathrooms: 1, difficulty: 'normal', notes: 'TEST request', appliances: 0, windowsSqm: 0, linenSets: 0, extraHours: 0 });
const plan = (startsAt = '2026-10-12T07:00:00.000Z') => ({ startsAt, durationMinutes: 120, bufferMinutes: 30, requiredTeams: 1, source: 'Confirmed visit duration', reason: 'TEST plan' });
function savePlan(requestId = id, startsAt?: string, assessmentVersion = 1, revision = 0) { return db.transaction(() => saveAssessmentPlan(db, { id: requestId, revision, assessmentVersion, definition: plan(startsAt) }, 'operator-verified', now)).immediate(); }
function verify(requestId = id, revision = 0, assessmentVersion = 1) { return db.transaction(() => verifyAssessmentQualification(db, { id: requestId, revision, assessmentVersion, reason: 'TEST verified current operational inputs', outcome: 'forged', actor: 'forged' }, 'operator-verified', now)).immediate(); }
function block(team = 't', start = '2026-10-12T07:00:00Z', end = '2026-10-12T11:00:00Z') { db.prepare('INSERT INTO workspace_team_blocks(id,team_id,starts_at,ends_at,reason,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(crypto.randomUUID(), team, start, end, 'TEST unavailable', 'f', now.toISOString()); }
function legacy(requestId = 'legacy', created = now.toISOString()) { db.prepare("INSERT INTO service_assessments(id,client_id,request_key,payload,category_version,category_definition,created_at) VALUES(?,'c',?,?,0,'{}',?)").run(requestId, requestId, JSON.stringify(input()), created); return requestId; }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); db = new Database(':memory:'); db.pragma('foreign_keys=ON'); initializeDatabase(db);
  db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client'),('f','firma','Firm'); INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('firm','f',1,'București'); INSERT INTO workspace_teams(id,firm_id,name,minimum_duration_minutes,travel_minutes) VALUES('t','firm','Team',0,0);");
  setCatalogFirm(db, 'maintenance', 'firm', true); setCatalogFirm(db, 'renovation', 'firm', true); id = createAssessment(db, 'c', 'request', input());
});
afterEach(() => { db.close(); vi.useRealTimers(); });
it('starts every new request pending atomically, leaves replay stable and never manufactures markers for legacy requests', () => {
  expect(assessmentQualification(db, id)).toMatchObject({ state: 'pending', tracked: true, revision: 0, stale: false });
  expect(db.prepare('SELECT outcome,actor_id FROM assessment_qualification_events WHERE assessment_id=?').get(id)).toEqual({ outcome: 'pending', actor_id: 'c' });
  expect(createAssessment(db, 'c', 'request', input())).toBe(id); expect(db.prepare('SELECT COUNT(*) n FROM assessment_qualification_events').get()).toEqual({ n: 1 });
  const old = legacy(); expect(createAssessment(db, 'c', old, input())).toBe(old); expect(assessmentQualification(db, old)).toMatchObject({ state: 'legacy_unknown', tracked: false, history: [] }); expect(() => verify(old)).toThrow('istorică');
});
it('rolls back assessment creation if its prospective marker cannot be recorded', () => {
  db.exec("CREATE TRIGGER fail_start BEFORE INSERT ON assessment_qualification_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  expect(() => createAssessment(db, 'c', 'blocked', input())).toThrow('audit unavailable'); expect(db.prepare("SELECT 1 FROM service_assessments WHERE request_key='blocked'").get()).toBeUndefined();
});
it('records current server checks with the verified author without creating offers, jobs, payments or capacity reservations', () => {
  savePlan(); const before = ['service_assessments', 'assessment_plans', 'jobs', 'payments', 'assessment_offers', 'workspace_assignments'].map(table => db.prepare(`SELECT * FROM ${table}`).all());
  const state = verify(); expect(state).toMatchObject({ state: 'ready', revision: 1, last: { actor_id: 'operator-verified', outcome: 'ready' }, observation: { snapshot: { capacity: { eligibleFirms: 1, capacityReserved: false } } } });
  expect(['service_assessments', 'assessment_plans', 'jobs', 'payments', 'assessment_offers', 'workspace_assignments'].map(table => db.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
  expect(() => verify()).toThrow('schimbat'); expect(() => db.exec('UPDATE assessment_qualification_events SET reason=\'edited\'')).toThrow('immutable'); expect(() => db.exec('DELETE FROM assessment_qualification_events')).toThrow('retained');
});
it('detects relevant capacity changes and a new plan without rewriting previous checks, and refreshes only through a new audited revision', () => {
  savePlan(); verify(); block(); const previous = db.prepare('SELECT snapshot_json FROM assessment_qualification_events WHERE assessment_id=? AND revision=1').get(id);
  expect(assessmentQualification(db, id)).toMatchObject({ state: 'pending', stale: true, last: { outcome: 'ready' }, observation: { outcome: 'unavailable' } });
  expect(verify(id, 1)).toMatchObject({ state: 'unavailable', stale: false, revision: 2 }); expect(db.prepare('SELECT snapshot_json FROM assessment_qualification_events WHERE assessment_id=? AND revision=1').get(id)).toEqual(previous);
  savePlan(id, '2026-10-13T07:00:00.000Z', 1, 1); expect(assessmentQualification(db, id)).toMatchObject({ state: 'pending', stale: true, observation: { outcome: 'ready' } }); expect(verify(id, 2).state).toBe('ready');
});
it('treats missing plans, unknown configuration and malformed intervals as pending, rather than available or commercially ineligible', () => {
  expect(verify().state).toBe('pending'); savePlan(); db.exec('UPDATE service_catalog_firms SET enabled=0'); expect(verify(id, 1).state).toBe('pending');
  db.exec('UPDATE service_catalog_firms SET enabled=1; UPDATE workspace_teams SET active=0'); expect(verify(id, 2).state).toBe('pending');
  db.exec('UPDATE workspace_teams SET active=1,travel_minutes=-1'); expect(verify(id, 3).state).toBe('pending');
  db.exec('UPDATE workspace_teams SET travel_minutes=0'); block('t', 'malformed', '2026-10-12T11:00:00Z'); expect(verify(id, 4).state).toBe('pending');
});
it('expires checks when the plan starts, or when assessment data/status changes, without altering accepted work', () => {
  savePlan(); verify(); vi.setSystemTime(new Date('2026-10-12T07:00:00Z')); expect(assessmentQualification(db, id)).toMatchObject({ state: 'pending', stale: true });
  vi.setSystemTime(now); updateAssessment(db, { clientId: 'c' }, id, 1, 'reply', 'Extra detail'); expect(assessmentQualification(db, id)).toMatchObject({ state: 'pending', stale: true, assessmentVersion: 2 });
  expect(() => verify(id, 1, 1)).toThrow('schimbat'); savePlan(id, undefined, 2, 1); expect(verify(id, 1, 2).state).toBe('ready');
  updateAssessment(db, { clientId: 'c' }, id, 2, 'cancel', ''); expect(assessmentQualification(db, id)).toMatchObject({ state: 'pending', stale: true });
});
it('requires current approved renovation evidence and makes additional photographs invalidate an earlier check', () => {
  const renovation = createAssessment(db, 'c', 'renovation', input('renovation')); savePlan(renovation); expect(verify(renovation).state).toBe('pending');
  db.exec("INSERT INTO job_photos(id,owner_user_id,proof_type,filename,status,validated_at) VALUES('photo','c','CLIENT_CONTEXT','photo.webp','VALID','2026-10-09T00:00:00Z')"); attachAssessmentPhoto(db, renovation, 'c', 'photo');
  reviewAssessmentEvidence(db, { id: renovation, version: 2, decision: 'approved', reason: 'TEST inspection' }, 'operator-verified'); savePlan(renovation, undefined, 2, 1);
  expect(verify(renovation, 1, 2).state).toBe('ready');
  db.exec("INSERT INTO job_photos(id,owner_user_id,proof_type,filename,status,validated_at) VALUES('extra','c','CLIENT_CONTEXT','extra.webp','VALID','2026-10-09T00:00:00Z')"); attachAssessmentPhoto(db, renovation, 'c', 'extra'); expect(assessmentQualification(db, renovation)).toMatchObject({ state: 'pending', stale: true, assessmentVersion: 3 });
});
it('reports the complete creation cohort, including pending, unavailable, cancelled and legacy unknown, without asserting commercial conversion', () => {
  savePlan(); verify(); const pending = createAssessment(db, 'c', 'pending', input()); updateAssessment(db, { clientId: 'c' }, pending, 1, 'cancel', '');
  const unavailable = createAssessment(db, 'c', 'unavailable', input()); savePlan(unavailable, '2026-10-13T07:00:00.000Z'); block('t', '2026-10-13T07:00:00Z', '2026-10-13T11:00:00Z'); verify(unavailable); legacy();
  const report = reportQualification(db, { from: '2026-10-09', to: '2026-10-09' }); expect(report.counts).toMatchObject({ total: 4, ready: 1, pending: 1, unavailable: 1, legacy_unknown: 1, stale: 0, cancelledOrDeclined: 1 }); expect(report.eligibleConversion.percent).toBeNull();
  expect(reportQualification(db, { from: '2026-10-09', to: '2026-10-09', city: "' OR 1=1 --" }).counts.total).toBe(0);
});
it('does not treat commercial catalog drafts as active qualification or pricing policy', () => {
  savePlan(); verify(); db.prepare("UPDATE service_catalog_drafts SET version=version+1,definition=? WHERE key='maintenance'").run(JSON.stringify({ cities: 'Iași', minSqm: 1000, maxSqm: 2000, durationMinutes: null, includes: '', excludes: '', equipment: '', extras: [] }));
  expect(assessmentQualification(db, id)).toMatchObject({ state: 'ready', stale: false }); expect(reportQualification(db, { from: '2026-10-09', to: '2026-10-09' }).eligibleConversion.percent).toBeNull(); expect(db.prepare('SELECT * FROM assessment_offers').all()).toEqual([]);
});
it('rejects oversized cohorts explicitly instead of dropping pending or unavailable requests from the denominator', () => {
  const insert = db.prepare("INSERT INTO service_assessments(id,client_id,request_key,payload,category_version,category_definition,created_at) VALUES(?,'c',?,?,0,'{}',?)");
  db.transaction(() => { for (let i = 0; i < 10000; i++) insert.run('large-' + i, 'large-' + i, JSON.stringify(input()), now.toISOString()); })();
  expect(() => reportQualification(db, { from: '2026-10-09', to: '2026-10-09' })).toThrow('10.000'); expect(reportQualification(db, { from: '2026-10-09', to: '2026-10-09', city: 'Iași' }).counts.total).toBe(0);
});
it.each([['2026-03-29', '2026-03-28T22:00:00Z', '2026-03-29T21:00:00Z'], ['2026-10-25', '2026-10-24T21:00:00Z', '2026-10-25T22:00:00Z']])('uses Romanian DST creation boundaries for the full cohort: %s', (day, start, end) => {
  legacy('before', new Date(Date.parse(start) - 1).toISOString()); legacy('start', start); legacy('last', new Date(Date.parse(end) - 1).toISOString()); legacy('after', end);
  expect(reportQualification(db, { from: day, to: day }).counts).toMatchObject({ total: 2, legacy_unknown: 2 });
});
