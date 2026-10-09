import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from './db';
import { saveScorePolicy, scorePolicy, validateScorePolicy } from './providerScore';
import { evaluateProviderScore, type ScoreInputs, type ScorePolicy } from './providerScoreShared';
import { providerScoreReport } from './providerScoreReport';
const definition = (): ScorePolicy => ({ mode: 'observation', periodDays: 30, minimumCompletedJobs: 2, minimumSamples: 2, weights: { rating: 50, punctuality: 50, reliability: 0, complaintFree: 0, evidence: 0 } });
const measurements = (): ScoreInputs => ({ completedJobs: 2, measurements: { rating: { percent: 80, samples: 2 }, punctuality: { percent: 50, samples: 2 }, reliability: { percent: null, samples: 0 }, complaintFree: { percent: null, samples: 0 }, evidence: { percent: null, samples: 0 } } });
let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); db.pragma('foreign_keys=ON'); initializeDatabase(db); });
afterEach(() => { db.close(); vi.useRealTimers(); });
it('requires explicit weights, period, volume and observation mode; rejects allocation controls', () => {
  for (const raw of [{ ...definition(), mode: 'active' }, { ...definition(), periodDays: 0 }, { ...definition(), periodDays: 366 }, { ...definition(), minimumSamples: 0 }, { ...definition(), automaticAllocation: true }, { ...definition(), weights: { ...definition().weights, rating: 10 } }, { ...definition(), weights: { ...definition().weights, profit: 0 } }]) expect(() => validateScorePolicy(raw)).toThrow();
  expect(validateScorePolicy(definition())).toEqual(definition());
});
it('does not invent a policy or a score for a new provider', () => {
  expect(scorePolicy(db)).toBeNull(); expect(providerScoreReport(db).providers).toEqual([]);
  const input = measurements(); input.completedJobs = 0;
  expect(evaluateProviderScore(definition(), input).score).toBeNull();
});
it('does not redistribute missing weights or penalize excluded components', () => {
  expect(evaluateProviderScore(definition(), measurements())).toMatchObject({ score: 65, automaticAllocation: false, reasons: [] });
  const input = measurements(); input.measurements.punctuality.samples = 1;
  expect(evaluateProviderScore(definition(), input)).toMatchObject({ score: null });
  input.measurements.punctuality = { percent: NaN, samples: 5 };
  expect(evaluateProviderScore(definition(), input).score).toBeNull();
});
it('preserves immutable history, verified actor, conflict and transaction rollback', () => {
  const save = (revision: number) => db.transaction(() => saveScorePolicy(db, { revision, definition: definition(), reason: 'Pilot controlat' }, 'manager_verified')).immediate();
  expect(save(0).revision).toBe(1); expect(() => save(0)).toThrow('Reîncarcă');
  expect(scorePolicy(db)?.actor).toBe('manager_verified');
  expect(() => db.transaction(() => { saveScorePolicy(db, { revision: 1, definition: definition(), reason: 'Test' }, 'manager_verified'); throw Error('audit unavailable'); }).immediate()).toThrow();
  expect(scorePolicy(db)?.revision).toBe(1);
  expect(() => db.prepare('UPDATE provider_score_policies SET reason=?').run('edited')).toThrow('immutable');
  expect(() => db.prepare('DELETE FROM provider_score_policies').run()).toThrow('retained');
});
it('uses Bucharest calendar window independent of host timezone and no automatic allocation', () => {
  db.transaction(() => saveScorePolicy(db, { revision: 0, definition: { ...definition(), periodDays: 2, weights: { rating: 0, punctuality: 0, reliability: 100, complaintFree: 0, evidence: 0 } }, reason: 'Calendar' }, 'admin')).immediate();
  providerFixtures();
  scoredJob('before-calendar', { created: '2026-03-27T21:59:59.999Z', status: 'no_show' });
  scoredJob('at-calendar-start', { created: '2026-03-27T22:00:00Z' });
  scoredJob('at-calendar-last', { created: '2026-03-29T20:59:59.999Z' });
  scoredJob('after-calendar', { created: '2026-03-29T21:00:00Z', status: 'no_show' });
  const report = providerScoreReport(db, new Date('2026-03-28T22:30:00Z'));
  expect(report.period).toEqual({ from: '2026-03-28', to: '2026-03-29', timezone: 'Europe/Bucharest' });
  expect(report.providers[0]).toMatchObject({ completedJobs: 2, observation: { score: 100, components: [{ key: 'reliability', samples: 2 }] } });
  expect(report.automaticAllocation).toBe(false);
});

const reportStamp = new Date('2026-10-09T12:00:00Z');
function providerFixtures() {
  db.exec("INSERT INTO users(id,role,name) VALUES('client-score','client','Client'),('provider-score','firma','Provider'),('other-provider-score','firma','Other provider'); INSERT INTO firms(id,user_id,coverage_city) VALUES('firm-score','provider-score','București'),('other-firm-score','other-provider-score','București');");
}
function scoredJob(id: string, patch: { status?: string; created?: string; accepted?: string | null; scheduled?: string | null; arrived?: string | null } = {}) {
  db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,created_at,accepted_at,scheduled_at,arrived_confirmed_at) VALUES(?,'client-score','Private','București',50,'apartament','scheduled',500,120,?,'firm-score',?,?,?,?)").run(id, patch.status ?? 'completed', patch.created ?? '2026-10-05T08:00:00Z', patch.accepted === undefined ? '2026-10-05T09:00:00Z' : patch.accepted, patch.scheduled ?? null, patch.arrived ?? null);
}
function onlyComponent(component: keyof ScorePolicy['weights']) {
  const policy = definition(); policy.weights = { rating: 0, punctuality: 0, reliability: 0, complaintFree: 0, evidence: 0 }; policy.weights[component] = 100; policy.minimumSamples = 1;
  db.transaction(() => saveScorePolicy(db, { revision: 0, definition: policy, reason: 'Test observation policy' }, 'manager-verified')).immediate();
}
function scoredPhoto(id: string, job: string, type: 'ARRIVAL' | 'COMPLETION', firm = 'firm-score', validated: string | null = '2026-10-05T12:00:00Z', status = 'VALID') {
  db.prepare("INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,status,validated_at) VALUES(?,?,'provider-score',?,?,?,?,?)").run(id, job, firm, type, id + '.webp', status, validated);
}
function scoredCase(id: string, job: string) {
  db.prepare("INSERT INTO visit_cases(id,job_id,opened_by,request_key,category,description,created_at,updated_at) VALUES(?,?,'client-score',?,'quality','Verify claim','2026-10-06T09:00:00Z','2026-10-06T09:00:00Z')").run(id, job, id);
}
function scoredReview(id: string, incident: string, outcome: string, at = '2026-10-06T10:00:00Z') {
  db.prepare("INSERT INTO visit_case_reviews VALUES(?,?,?,'Evidence checked','manager-verified',?)").run(id, incident, outcome, at);
}
it('measures frozen photo minima using only validated proofs from the assigned provider, including legacy requirements', () => {
  providerFixtures(); onlyComponent('evidence');
  for (const id of ['legacy-proof', 'snapshot-proof', 'unvalidated-proof', 'foreign-proof']) scoredJob(id);
  db.prepare('INSERT INTO job_photo_rules VALUES(?,?,?)').run('snapshot-proof', 2, 2);
  for (const job of ['legacy-proof', 'snapshot-proof']) { scoredPhoto(job + '-a', job, 'ARRIVAL'); scoredPhoto(job + '-c', job, 'COMPLETION'); }
  scoredPhoto('unvalidated-a', 'unvalidated-proof', 'ARRIVAL', 'firm-score', null); scoredPhoto('unvalidated-c', 'unvalidated-proof', 'COMPLETION', 'firm-score', null);
  scoredPhoto('foreign-a', 'foreign-proof', 'ARRIVAL', 'other-firm-score'); scoredPhoto('foreign-c', 'foreign-proof', 'COMPLETION', 'other-firm-score');
  scoredPhoto('rejected', 'snapshot-proof', 'ARRIVAL', 'firm-score', '2026-10-05T12:00:00Z', 'REJECTED');
  const first = providerScoreReport(db, reportStamp).providers[0]; expect(first.completedJobs).toBe(4); expect(first.observation).toMatchObject({ score: 25, automaticAllocation: false, components: [{ key: 'evidence', samples: 4, percent: 25 }] });
  scoredPhoto('snapshot-extra-a', 'snapshot-proof', 'ARRIVAL'); scoredPhoto('snapshot-extra-c', 'snapshot-proof', 'COMPLETION');
  expect(providerScoreReport(db, reportStamp).providers[0].observation.score).toBe(50);
});
it('withholds complaint score for unverified allegations and deduplicates confirmed claims by completed job using latest reviews', () => {
  providerFixtures(); onlyComponent('complaintFree'); scoredJob('complained'); scoredJob('pending');
  scoredCase('confirmed-a', 'complained'); scoredCase('confirmed-b', 'complained'); scoredCase('unreviewed', 'pending');
  scoredReview('review-a', 'confirmed-a', 'confirmed'); scoredReview('review-b', 'confirmed-b', 'confirmed');
  const snapshot = () => [db.prepare('SELECT * FROM firms ORDER BY id').all(), db.prepare('SELECT * FROM jobs ORDER BY id').all()];
  const before = snapshot(); const pending = providerScoreReport(db, reportStamp).providers[0];
  expect(pending.pendingComplaintJobs).toBe(1); expect(pending.observation).toMatchObject({ score: null, automaticAllocation: false, components: [{ key: 'complaintFree', samples: 2, percent: null }] }); expect(snapshot()).toEqual(before);
  scoredReview('review-unverified', 'unreviewed', 'not_confirmed');
  expect(providerScoreReport(db, reportStamp).providers[0].observation).toMatchObject({ score: 50, reasons: [], components: [{ key: 'complaintFree', samples: 2, percent: 50 }] });
  scoredReview('review-a-latest', 'confirmed-a', 'not_confirmed', '2026-10-07T10:00:00Z'); expect(providerScoreReport(db, reportStamp).providers[0].observation.score).toBe(50);
  scoredReview('review-b-latest', 'confirmed-b', 'needs_information', '2026-10-07T11:00:00Z');
  expect(providerScoreReport(db, reportStamp).providers[0]).toMatchObject({ pendingComplaintJobs: 1, observation: { score: null } }); expect(snapshot()).toEqual(before);
});
it('uses published ratings for completed jobs and preserves missing rating data rather than redistributing weights', () => {
  providerFixtures(); const policy = { ...definition(), minimumSamples: 1 };
  db.transaction(() => saveScorePolicy(db, { revision: 0, definition: policy, reason: 'Test ratings' }, 'manager-verified')).immediate();
  scoredJob('rated-good', { scheduled: '2026-10-05T10:00:00Z', arrived: '2026-10-05T09:59:00Z' });
  scoredJob('rated-hidden', { scheduled: '2026-10-05T10:00:00Z', arrived: '2026-10-05T10:01:00Z' });
  scoredJob('rated-unfinished', { status: 'accepted' }); scoredJob('rated-foreign');
  const rating = db.prepare("INSERT INTO ratings(id,job_id,firm_id,client_id,stars,status,moderation_status) VALUES(?,?,?,'client-score',?,'active',?)");
  rating.run('good', 'rated-good', 'firm-score', 5, 'published'); rating.run('hidden', 'rated-hidden', 'firm-score', 1, 'hidden'); rating.run('unfinished', 'rated-unfinished', 'firm-score', 1, 'published'); rating.run('foreign', 'rated-foreign', 'other-firm-score', 1, 'published');
  expect(providerScoreReport(db, reportStamp).providers[0].observation).toMatchObject({ score: 75, components: [{ key: 'rating', samples: 1, percent: 100 }, { key: 'punctuality', samples: 2, percent: 50 }] });
  db.prepare("UPDATE ratings SET moderation_status='hidden' WHERE id='good'").run();
  expect(providerScoreReport(db, reportStamp).providers[0].observation).toMatchObject({ score: null, components: [{ key: 'rating', samples: 0, percent: null }, { key: 'punctuality', samples: 2, percent: 50 }] });
});
it('calculates reliability only from recorded allocations and excludes providers outside the Romanian creation window', () => {
  providerFixtures(); onlyComponent('reliability'); scoredJob('allocated-a'); scoredJob('allocated-b'); scoredJob('allocated-no-show', { status: 'no_show' });
  scoredJob('unallocated', { status: 'waiting', accepted: null }); scoredJob('outside', { created: '2026-09-01T10:00:00Z', status: 'no_show' });
  const report = providerScoreReport(db, reportStamp); expect(report.providers).toHaveLength(1); expect(report.providers[0].observation).toMatchObject({ score: 66.67, components: [{ key: 'reliability', samples: 3 }] }); expect(report.automaticAllocation).toBe(false);
});
