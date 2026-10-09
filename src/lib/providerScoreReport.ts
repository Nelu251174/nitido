import type { Database } from 'better-sqlite3';
import { operationalReport } from './operationalReport';
import { scorePolicy } from './providerScore';
import { evaluateProviderScore } from './providerScoreShared';
import { bucharestDateKey } from './scheduling';
import { hostLocalInstant } from './hostScheduleShared';

export function providerScoreReport(db: Database, stamp = new Date()) {
  return db.transaction(() => {
    const policy = scorePolicy(db);
    if (!policy) return { policy: null, period: null, providers: [], automaticAllocation: false as const };
    const to = bucharestDateKey(stamp), start = new Date(to + 'T12:00:00Z');
    start.setUTCDate(start.getUTCDate() - policy.definition.periodDays + 1);
    const from = start.toISOString().slice(0, 10), end = new Date(to + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() + 1);
    const bounds = [hostLocalInstant(from, 0), hostLocalInstant(end.toISOString().slice(0, 10), 0)];
    const report = operationalReport(db, { from, to });
    const providers = report.providers.map(provider => {
      const counts = db.prepare(`SELECT COUNT(*) completed,
        SUM(CASE WHEN
          (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE(r.arrival_min,1)
          AND (SELECT COUNT(*) FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)>=COALESCE(r.completion_min,1)
          THEN 1 ELSE 0 END) evidence
        FROM jobs j LEFT JOIN job_photo_rules r ON r.job_id=j.id
        WHERE j.accepted_firm_id=? AND j.status='completed' AND julianday(j.created_at)>=julianday(?) AND julianday(j.created_at)<julianday(?)`).get(provider.id, ...bounds) as { completed: number; evidence: number | null };
      const allocations = db.prepare(`SELECT COUNT(*) samples,SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END) no_show FROM jobs WHERE accepted_firm_id=? AND accepted_at IS NOT NULL AND julianday(created_at)>=julianday(?) AND julianday(created_at)<julianday(?)`).get(provider.id, ...bounds) as { samples: number; no_show: number | null };
      const ratio = (n: number, d: number) => ({ percent: d ? n * 100 / d : null, samples: d });
      const observation = evaluateProviderScore(policy.definition, {
        completedJobs: provider.completed,
        measurements: {
          rating: { percent: provider.averageRating === null ? null : provider.averageRating * 20, samples: provider.ratingCount },
          punctuality: ratio(provider.arrivedByScheduled, provider.arrivalSamples),
          reliability: ratio(allocations.samples - (allocations.no_show ?? 0), allocations.samples),
          complaintFree: { ...ratio(provider.completed - provider.confirmedComplaintJobs, provider.completed), percent: provider.unreviewedComplaintJobs ? null : ratio(provider.completed - provider.confirmedComplaintJobs, provider.completed).percent },
          evidence: ratio(counts.evidence ?? 0, counts.completed),
        },
      });
      return { id: provider.id, name: provider.name, completedJobs: provider.completed, pendingComplaintJobs: provider.unreviewedComplaintJobs, policyRevision: policy.revision, observation };
    });
    return { policy, period: { from, to, timezone: 'Europe/Bucharest' }, providers, automaticAllocation: false as const };
  })();
}
