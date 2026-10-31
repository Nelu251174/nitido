import type {Database} from 'better-sqlite3';
import {hasAdminPermission, type AdminRole} from './adminRolesShared';
import {ownerAttention, type AttentionItem} from './ownerAttention';
import {bucharestDateKey} from './scheduling';
import {proReportPeriod} from './pro/reportPeriod';

const DISPLAY_LIMIT = 20;

export type DashboardAttentionItem = AttentionItem & {reasons: AttentionItem[]};
export type DashboardScheduledJob = {
  id: string;
  city: string;
  street: string | null;
  status: string;
  scheduled_at: string;
  firm_name: string | null;
  client_name: string | null;
};
export type AdminDashboard = {
  checkedAt: string;
  timezone: 'Europe/Bucharest';
  date: string;
  counts: {urgent: number; attention: number; scheduledToday: number; financialIssues: number | null};
  attention: {items: DashboardAttentionItem[]; total: number; limit: number; limits: string};
  schedule: {jobs: DashboardScheduledJob[]; total: number; limit: number};
};

function destination(item: AttentionItem): string {
  if (item.key.startsWith('case:') && item.jobId) {
    return '/admin/suport?tab=incidente&jobId=' + encodeURIComponent(item.jobId);
  }
  if (item.key.startsWith('extra-work:')) return '/admin/lucrari?tab=evaluari';
  if (item.key === 'notifications' || item.key === 'appointment-delivery') {
    return '/admin/suport?tab=notificari';
  }
  return item.jobId ? '/admin/lucrari?jobId=' + encodeURIComponent(item.jobId) : item.href;
}

/** One dossier per job, retaining every rule and its destination in priority order. */
export function groupDashboardAttention(items: AttentionItem[]): DashboardAttentionItem[] {
  const grouped = new Map<string, DashboardAttentionItem>();
  for (const original of items) {
    const item = {...original, href: destination(original)};
    const key = item.jobId ? 'job:' + item.jobId : item.key;
    const group = grouped.get(key);
    if (group) group.reasons.push(item);
    else grouped.set(key, {...item, reasons: [item]});
  }
  return [...grouped.values()];
}

/** Read-only snapshot; no schedules, messages or financial mutations are triggered. */
export function adminDashboard(db: Database, role: AdminRole, now = new Date(), includeAllAttention = false): AdminDashboard {
  if (!hasAdminPermission(role, 'operations')) throw new Error('Acces operațional necesar.');
  const date = bucharestDateKey(now);
  const period = proReportPeriod(date, date);
  const scheduledWhere = `j.scheduled_at IS NOT NULL
    AND j.status NOT IN ('cancelled', 'no_show')
    AND julianday(j.scheduled_at) >= julianday(?)
    AND julianday(j.scheduled_at) < julianday(?)`;
  return db.transaction((): AdminDashboard => {
    const report = ownerAttention(db, now);
    const attention = groupDashboardAttention(report.items);
    const scheduledToday = (db.prepare(`SELECT COUNT(*) AS n FROM jobs j WHERE ${scheduledWhere}`)
      .get(period.startsAt, period.endsBefore) as {n: number}).n;
    const jobs = db.prepare(`SELECT j.id,j.city,${role === 'super_admin' ? 'j.street' : 'NULL'} AS street,j.status,j.scheduled_at,
      client.name AS client_name,provider.name AS firm_name
      FROM jobs j LEFT JOIN users client ON client.id=j.client_id
      LEFT JOIN firms firm ON firm.id=j.accepted_firm_id
      LEFT JOIN users provider ON provider.id=firm.user_id
      WHERE ${scheduledWhere} ORDER BY julianday(j.scheduled_at),j.id LIMIT ?`)
      .all(period.startsAt, period.endsBefore, DISPLAY_LIMIT) as DashboardScheduledJob[];
    // Counts payment records once, even when several explicit exception flags coexist.
    // Pending authorizations and bank balances are deliberately not inferred as failures.
    const financialIssues = hasAdminPermission(role, 'finance')
      ? (db.prepare(`SELECT COUNT(*) AS n FROM payments WHERE
        transfer_status IN ('failed','blocked') OR payout_status='failed'
        OR refund_status IN ('failed','pending')
        OR dispute_status IN ('needs_response','under_review','warning_needs_response','warning_under_review')`)
        .get() as {n: number}).n
      : null;
    return {
      checkedAt: now.toISOString(), timezone: 'Europe/Bucharest', date,
      counts: {
        urgent: attention.filter(item => item.severity === 'urgent').length,
        attention: attention.filter(item => item.severity === 'attention').length,
        scheduledToday, financialIssues,
      },
      attention: {
        items: includeAllAttention ? attention : attention.slice(0, DISPLAY_LIMIT), total: attention.length,
        limit: includeAllAttention ? attention.length : DISPLAY_LIMIT,
        limits: report.limits + ' Semnalele pentru aceeași lucrare sunt grupate; notificările sunt grupuri separate. '
          + (includeAllAttention ? 'Sunt afișate toate grupurile rezultate din aceste reguli și limite. ' : 'Se afișează primele 20 de dosare sau grupuri. ')
          + 'Numerele descriu regulile și limitele verificate, nu un audit complet.',
      },
      schedule: {jobs, total: scheduledToday, limit: DISPLAY_LIMIT},
    };
  })();
}
