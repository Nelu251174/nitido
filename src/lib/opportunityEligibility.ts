import type { Database } from 'better-sqlite3';
import type { JobRow } from './types';
import { firmCoversCity } from './text';
import { firmAvailabilityError } from './firmAvailability';
import { checkAssistedTeam, jobAssistedOperation } from './assistedOperations';
import { MarginError } from './operationalMargin';

/** Read-only preview gate. Acceptance must still recheck inside its writer transaction. */
export function canPreviewOpportunity(db: Database, firmId: string, job: JobRow): boolean {
  if (job.status !== 'waiting') return false;
  const firm = db.prepare('SELECT verified,suspended_until,coverage_city,coverage_cities_extra FROM firms WHERE id=?').get(firmId) as {
    verified: number; suspended_until: string | null; coverage_city: string; coverage_cities_extra: string | null;
  } | undefined;
  if (!firm?.verified || !firmCoversCity(firm.coverage_city, firm.coverage_cities_extra, job.city)) return false;
  if (firm.suspended_until && (!Number.isFinite(Date.parse(firm.suspended_until)) || Date.parse(firm.suspended_until) > Date.now())) return false;
  if (firmAvailabilityError(db, firmId, job)) return false;
  const plan = jobAssistedOperation(db, job.id);
  if (plan) {
    if (plan.firmId !== firmId) return false;
    try { checkAssistedTeam(db, plan, job.id); }
    catch (error) {
      if (error instanceof MarginError && error.status < 500) return false;
      throw error;
    }
  }
  return true;
}
