import { bookingDateKey } from '../scheduling';
import { hostLocalInstant } from '../hostScheduleShared';

export type ProReportPeriod = { from: string; to: string; startsAt: string | null; endsBefore: string | null; timezone: 'Europe/Bucharest' };
/** Inclusive civil dates become half-open instants, including 23/25-hour DST days. */
export function proReportPeriod(from = '', to = ''): ProReportPeriod {
  for (const day of [from, to]) if (day && (bookingDateKey(day) !== day || !/^\d{4}-\d{2}-\d{2}$/.test(day))) throw new Error('Perioadă invalidă.');
  if (from && to && from > to) throw new Error('Perioadă inversată.');
  let endsBefore: string | null = null;
  if (to) {
    const next = new Date(to + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
    const nextDay = next.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDay)) throw new Error('Perioadă invalidă.');
    endsBefore = hostLocalInstant(nextDay, 0);
  }
  return { from, to, startsAt: from ? hostLocalInstant(from, 0) : null, endsBefore, timezone: 'Europe/Bucharest' };
}

/** Legacy date-only registry entries are civil days, represented at noon for filtering. */
export function proReportTimestamp(column: string) {
  if (!/^[a-z_]+\.[a-z_]+$/.test(column)) throw new Error('Coloană de raport invalidă.');
  return `julianday(CASE WHEN length(${column})=10 THEN ${column}||'T12:00:00Z' ELSE ${column} END)`;
}
