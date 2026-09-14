import type { Database } from 'better-sqlite3';

export type JobTiming = {
  id: string;
  scheduled_at: string | null;
  when_type: string;
  duration_minutes: number;
  buffer_minutes: number;
};

function interval(job: JobTiming): { start: number; end: number } | null {
  const start = Date.parse(job.scheduled_at ?? '');
  const duration = job.duration_minutes;
  const buffer = job.buffer_minutes;
  const end = start + (duration + buffer) * 60000;
  if (!Number.isSafeInteger(duration) || duration <= 0 || !Number.isSafeInteger(buffer) || buffer < 0
    || !Number.isFinite(start) || !Number.isSafeInteger(end) || !Number.isFinite(new Date(end).getTime())) return null;
  return { start, end };
}

/** Conservative existing firm-wide capacity rule; call inside the reservation transaction. */
export function firmAvailabilityError(db: Database, firmId: string, job: JobTiming): string | null {
  const candidate = interval(job);
  // Preserve legacy ASAP jobs without a timestamp, but never treat their occupied time as free.
  const legacyAsap = job.scheduled_at === null && job.when_type === 'asap'
    && Number.isSafeInteger(job.duration_minutes) && job.duration_minutes > 0
    && Number.isSafeInteger(job.buffer_minutes) && job.buffer_minutes >= 0;
  if (!candidate && !legacyAsap) return 'Programarea sau durata lucrării necesită corectare înainte de preluare.';
  const existing = db.prepare(`SELECT id,scheduled_at,when_type,duration_minutes,buffer_minutes FROM jobs
    WHERE accepted_firm_id=? AND status IN ('accepted','arrived') AND id!=?`).all(firmId, job.id) as JobTiming[];
  for (const other of existing) {
    const occupied = interval(other);
    if (!candidate || !occupied) return 'Există o lucrare cu interval neconfirmat. Completează planificarea înainte de o nouă preluare.';
    if (candidate.start < occupied.end && occupied.start < candidate.end) return 'Se suprapune cu o altă lucrare a firmei, inclusiv timpul de deplasare.';
  }
  return null;
}
