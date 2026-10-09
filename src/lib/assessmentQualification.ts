import type { Database } from 'better-sqlite3';
import { assessmentPlanCapacity, listAssessmentPlans } from './assessmentPlan';
import { readAssessmentEvidence } from './assessmentEvidence';
import { firmCoversCity } from './text';
import { hostLocalInstant } from './hostScheduleShared';
import { CATALOG_CATEGORIES } from './serviceCatalog';
import { QUALIFICATION_BASIS, type QualificationOutcome } from './assessmentQualificationShared';

export class QualificationError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Assessment = { id: string; version: number; status: string; payload: string };
type Event = { revision: number; assessment_version: number; criteria_version: number; outcome: QualificationOutcome; snapshot_json: string; reason: string; actor_id: string; created_at: string };
function assessment(db: Database, id: unknown) {
  if (typeof id !== 'string' || !id || id.length > 100) throw new QualificationError('Referință cerere invalidă.');
  const row = db.prepare('SELECT id,version,status,payload FROM service_assessments WHERE id=?').get(id) as Assessment | undefined;
  if (!row) throw new QualificationError('Cerere inexistentă.', 404);
  return row;
}
function latest(db: Database, id: string) {
  return db.prepare('SELECT * FROM assessment_qualification_events WHERE assessment_id=? ORDER BY revision DESC LIMIT 1').get(id) as Event | undefined;
}
function confirmedCapacityInputs(db: Database, category: string, city: string) {
  const firms = db.prepare('SELECT f.id,f.coverage_city,f.coverage_cities_extra,f.suspended_until FROM firms f JOIN service_catalog_firms c ON c.firm_id=f.id WHERE c.category_key=? AND c.enabled=1').all(category) as { id: string; coverage_city: string; coverage_cities_extra: string | null; suspended_until: string | null }[];
  const relevant = firms.filter(f => firmCoversCity(f.coverage_city, f.coverage_cities_extra, city));
  if (!relevant.length) return false;
  return relevant.every(f => {
    if (f.suspended_until && !Number.isFinite(Date.parse(f.suspended_until))) return false;
    const teams = db.prepare('SELECT id,minimum_duration_minutes,travel_minutes FROM workspace_teams WHERE firm_id=? AND active=1').all(f.id) as { id: string; minimum_duration_minutes: number; travel_minutes: number }[];
    if (!teams.length || teams.some(t => !Number.isSafeInteger(t.minimum_duration_minutes) || t.minimum_duration_minutes < 0 || !Number.isSafeInteger(t.travel_minutes) || t.travel_minutes < 0)) return false;
    for (const team of teams) {
      const blocks = db.prepare('SELECT starts_at,ends_at FROM workspace_team_blocks WHERE team_id=? AND cancelled=0').all(team.id) as { starts_at: string; ends_at: string }[];
      if (blocks.some(b => !Number.isFinite(Date.parse(b.starts_at)) || !Number.isFinite(Date.parse(b.ends_at)) || Date.parse(b.ends_at) <= Date.parse(b.starts_at))) return false;
    }
    const jobs = db.prepare("SELECT scheduled_at,duration_minutes,buffer_minutes FROM jobs WHERE accepted_firm_id=? AND status IN ('accepted','arrived')").all(f.id) as { scheduled_at: string | null; duration_minutes: number; buffer_minutes: number }[];
    return jobs.every(j => Number.isFinite(Date.parse(j.scheduled_at ?? '')) && Number.isSafeInteger(j.duration_minutes) && j.duration_minutes > 0 && Number.isSafeInteger(j.buffer_minutes) && j.buffer_minutes >= 0);
  });
}

function observe(db: Database, a: Assessment, now: Date) {
  const request = JSON.parse(a.payload) as { category: string; city: string };
  const saved = listAssessmentPlans(db, a.id)[0] ?? null;
  const evidence = request.category === 'renovation' ? readAssessmentEvidence(db, a.id, null) : null;
  const evidenceSnapshot = evidence ? { version: evidence.version, photoIds: evidence.photos.map(p => p.id), review: evidence.review ? { id: evidence.review.id, decision: evidence.review.decision, current: evidence.review.current } : null } : null;
  const planCurrent = !!saved && saved.assessment_version === a.version;
  const planFuture = !!saved && Number.isFinite(Date.parse(saved.definition.startsAt)) && Date.parse(saved.definition.startsAt) > now.getTime();
  const capacity = saved && planCurrent && planFuture ? assessmentPlanCapacity(db, a, saved.definition, now) : null;
  const confirmedInputs = capacity ? confirmedCapacityInputs(db, request.category, request.city) : false;
  const checks: string[] = [];
  if (['cancelled', 'declined'].includes(a.status)) checks.push('Cererea este închisă; nu se confirmă pregătirea unui plan nou.');
  if (!saved) checks.push('Nu există un plan verificabil.');
  else if (!planCurrent) checks.push('Planul aparține altei versiuni a cererii.');
  else if (!planFuture) checks.push('Intervalul planului nu mai este viitor.');
  if (evidence && (!evidence.photos.length || !evidence.review?.current || evidence.review.decision !== 'approved')) checks.push('Fotografiile pentru renovare nu sunt aprobate pentru versiunea curentă.');
  let outcome: QualificationOutcome = 'pending';
  if (!checks.length && capacity) {
    if (capacity.eligibleFirms > 0) outcome = 'ready';
    else if (confirmedInputs) outcome = 'unavailable';
    else checks.push('Configurarea sau intervalele capacității sunt incomplete ori necunoscute.');
  }
  if (outcome === 'unavailable') checks.push('Firmele configurate nu au capacitate disponibilă pentru acest plan și interval.');
  if (outcome === 'ready') checks.push('Verificările operaționale existente pentru acest plan sunt îndeplinite; capacitatea nu este rezervată.');
  // checkedAt is deliberately excluded from the comparison: mere re-reading is not a configuration change.
  const capacitySnapshot = capacity ? { ...capacity, checkedAt: undefined } : null;
  const snapshot = { source: 'plan.capacity.evidence', assessmentVersion: a.version, assessmentStatus: a.status, planRevision: saved?.revision ?? null, plan: saved?.definition ?? null, planCurrent, planFuture, confirmedInputs, capacity: capacitySnapshot, evidence: evidenceSnapshot, checks, outcome };
  return { outcome, snapshot };
}
function current(db: Database, a: Assessment, now: Date) {
  const row = latest(db, a.id);
  if (!row) return { state: 'legacy_unknown' as const, tracked: false, stale: false, revision: 0, assessmentVersion: a.version, last: null, observation: null, basis: QUALIFICATION_BASIS };
  const observation = observe(db, a, now);
  const stale = row.revision > 0 && row.snapshot_json !== JSON.stringify(observation.snapshot);
  return { state: stale || row.revision === 0 ? 'pending' as const : row.outcome, tracked: true, stale, revision: row.revision, assessmentVersion: a.version, last: { ...row, snapshot: JSON.parse(row.snapshot_json) as unknown, snapshot_json: undefined }, observation, basis: QUALIFICATION_BASIS };
}
export function assessmentQualification(db: Database, id: unknown, before?: number, now = new Date()) {
  if (before !== undefined && (!Number.isSafeInteger(before) || before < 0)) throw new QualificationError('Pagină istoric invalidă.');
  return db.transaction(() => {
    const a = assessment(db, id), state = current(db, a, now);
    const events = db.prepare('SELECT * FROM assessment_qualification_events WHERE assessment_id=? AND revision<? ORDER BY revision DESC LIMIT 51').all(a.id, before ?? Number.MAX_SAFE_INTEGER) as Event[];
    return { ...state, history: events.slice(0, 50).map(row => ({ ...row, snapshot: JSON.parse(row.snapshot_json) as unknown, snapshot_json: undefined })), hasMore: events.length > 50 };
  })();
}
export function verifyAssessmentQualification(db: Database, b: Record<string, unknown>, actor: string, now = new Date()) {
  if (!db.inTransaction || !actor) throw new QualificationError('Verificarea și auditul necesită aceeași tranzacție.', 500);
  const a = assessment(db, b.id), row = latest(db, a.id);
  if (!row) throw new QualificationError('Cererea este istorică, fără jurnal prospectiv. Nu se reconstruiește eligibilitatea din trecut.', 409);
  if (b.revision !== row.revision || b.assessmentVersion !== a.version) throw new QualificationError('Cererea sau verificarea s-a schimbat. Actualizează înainte de salvare.', 409);
  if (typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 2000) throw new QualificationError('Motiv intern obligatoriu, maximum 2.000 de caractere.');
  const observation = observe(db, a, now), revision = row.revision + 1;
  db.prepare('INSERT INTO assessment_qualification_events VALUES(?,?,?,1,?,?,?,?,?)').run(a.id, revision, a.version, observation.outcome, JSON.stringify(observation.snapshot), b.reason.trim(), actor, now.toISOString());
  return current(db, a, now);
}

export type QualificationFilters = { from: string; to: string; city?: string; category?: string; client?: string };
export function reportQualification(db: Database, filters: QualificationFilters, now = new Date()) {
  let from: string, end: string;
  try {
    from = hostLocalInstant(filters.from, 0); hostLocalInstant(filters.to, 0);
    const next = new Date(filters.to + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + 1); end = hostLocalInstant(next.toISOString().slice(0, 10), 0);
  } catch { throw new QualificationError('Alege date calendaristice valide.'); }
  if (filters.from > filters.to || Date.parse(end) - Date.parse(from) > 367 * 86400000) throw new QualificationError('Alege o perioadă de maximum un an, în ordine cronologică.');
  for (const value of [filters.city, filters.client]) if (value !== undefined && (typeof value !== 'string' || value.length > 150)) throw new QualificationError('Filtru invalid.');
  if (filters.category && !CATALOG_CATEGORIES.some(([key]) => key === filters.category)) throw new QualificationError('Serviciu invalid.');
  return db.transaction(() => {
    const rows = db.prepare("SELECT a.id,a.version,a.status,a.payload,EXISTS(SELECT 1 FROM assessment_offers o JOIN assessment_offer_jobs l ON l.offer_id=o.id WHERE o.assessment_id=a.id) booked FROM service_assessments a WHERE julianday(a.created_at)>=julianday(?) AND julianday(a.created_at)<julianday(?) AND (?='' OR json_extract(a.payload,'$.city')=?) AND (?='' OR json_extract(a.payload,'$.category')=?) AND (?='' OR a.client_id=?) ORDER BY a.created_at,a.id LIMIT 10001").all(from, end, filters.city ?? '', filters.city ?? '', filters.category ?? '', filters.category ?? '', filters.client ?? '', filters.client ?? '') as (Assessment & { booked: number })[];
    if (rows.length > 10000) throw new QualificationError('Raportul depășește 10.000 de cereri. Restrânge selecția pentru un raport complet.', 422);
    const counts = { total: rows.length, ready: 0, unavailable: 0, pending: 0, legacy_unknown: 0, stale: 0, cancelledOrDeclined: 0, bookingsLinked: 0, trackedBookingsLinked: 0 };
    for (const row of rows) { const state = current(db, row, now); counts[state.state]++; if (state.stale) counts.stale++; if (['cancelled', 'declined'].includes(row.status)) counts.cancelledOrDeclined++; if (row.booked) { counts.bookingsLinked++; if (state.tracked) counts.trackedBookingsLinked++; } }
    return { filters, timezone: 'Europe/Bucharest', basis: QUALIFICATION_BASIS, cohort: 'Toate cererile create în perioada selectată, inclusiv cele neverificate, indisponibile și istorice. Pregătirea afișată este starea curentă; rezervările sunt legături descriptive.', counts, eligibleConversion: { percent: null, reason: 'Calificarea pentru un plan nu definește eligibilitatea comercială a cererilor. KPI-ul din brief rămâne indisponibil.' } };
  })();
}
export type AssessmentQualification = ReturnType<typeof assessmentQualification>;
export type QualificationReport = ReturnType<typeof reportQualification>;
