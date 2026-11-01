import {activeAccountSql} from './accountStatus';
import type {Database} from 'better-sqlite3';
import {hasAdminPermission, type AdminRole} from './adminRolesShared';
import {proReportPeriod} from './pro/reportPeriod';

export class AdminQueryError extends Error {}
const JOB_STATES = ['waiting', 'accepted', 'arrived', 'completed', 'no_show', 'cancelled'];
const LIMIT = 50;
const term = (value: string | null, max: number) => {
  const text = (value ?? '').trim();
  if (text.length > max) throw new AdminQueryError('Filtrul este prea lung.');
  return text;
};
const like = (value: string) => '%' + value.replace(/[\\%_]/g, '\\$&') + '%';
function offset(params: URLSearchParams) {
  const value = Number(params.get('offset') ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new AdminQueryError('Pagină invalidă.');
  return value;
}

export function adminWorkbench(db: Database, role: AdminRole, params: URLSearchParams) {
  const pageOffset = offset(params);
  const q = term(params.get('q'), 150), city = term(params.get('city'), 100);
  const status = term(params.get('status'), 30), date = term(params.get('date'), 10);
  const scheduled = params.get('scheduled');
  if (scheduled && scheduled !== '1') throw new AdminQueryError('Filtrul programărilor este invalid.');
  const jobId = term(params.get('jobId'), 100);
  if (jobId && !/^[A-Za-z0-9_-]{1,100}$/.test(jobId)) throw new AdminQueryError('Identificator invalid.');
  if (status && status !== 'all' && !JOB_STATES.includes(status)) throw new AdminQueryError('Stare invalidă.');
  const conditions: string[] = [], args: unknown[] = [];
  if (jobId) {conditions.push('j.id=?'); args.push(jobId);}
  if (q) {
    const columns = ['j.id', 'j.city', 'client.name', 'provider.name'];
    if (role === 'super_admin') columns.push('j.street');
    conditions.push('(' + columns.map(column => `${column} LIKE ? ESCAPE '\\'`).join(' OR ') + ')');
    args.push(...Array(columns.length).fill(like(q)));
  }
  if (city) {conditions.push('j.city=?'); args.push(city);}
  if (status && status !== 'all') {conditions.push('j.status=?'); args.push(status);}
  if (scheduled === '1') conditions.push("j.scheduled_at IS NOT NULL AND j.status NOT IN ('cancelled','no_show')");
  if (date) {
    try {
      const period = proReportPeriod(date, date);
      conditions.push('julianday(j.scheduled_at)>=julianday(?) AND julianday(j.scheduled_at)<julianday(?)');
      args.push(period.startsAt, period.endsBefore);
    } catch {throw new AdminQueryError('Data programării este invalidă.');}
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const from = ` FROM jobs j LEFT JOIN users client ON client.id=j.client_id
    LEFT JOIN firms firm ON firm.id=j.accepted_firm_id LEFT JOIN users provider ON provider.id=firm.user_id`;
  const financial = hasAdminPermission(role, 'finance');
  return db.transaction(() => {
    const total = (db.prepare('SELECT COUNT(*) AS n' + from + where).get(...args) as {n: number}).n;
    const rows = db.prepare(`SELECT j.id,j.city,${role === 'super_admin' ? 'j.street' : 'NULL'} AS street,j.client_id,j.sqm,j.duration_minutes,
      j.status,j.scheduled_at,j.accepted_firm_id,j.created_at,j.accepted_at,j.arrived_confirmed_at,j.completed_at,
      client.name AS client_name,provider.name AS firm_name`
      + from + where + ' ORDER BY j.created_at DESC,j.id LIMIT ? OFFSET ?')
      .all(...args, LIMIT, pageOffset) as {id: string; [key: string]: unknown}[];
    const jobs = rows.map(job => ({...job, ...(financial ? {
      payments: db.prepare(`SELECT p.id,p.status,p.amount_gross,p.refund_status,p.transfer_status,
        p.payout_status,p.dispute_status,p.stripe_payment_intent_id,r.stripe_refund_id
        FROM payments p LEFT JOIN payment_refunds r ON r.payment_id=p.id WHERE p.job_id=?`).all(job.id),
    } : {})}));
    return {jobs, hasMore: pageOffset + jobs.length < total, financial, total, offset: pageOffset, limit: LIMIT};
  })();
}

export function adminFirms(db: Database, params: URLSearchParams) {
  const pageOffset = offset(params);
  const q = term(params.get('q'), 150), city = term(params.get('city'), 100);
  const verified = term(params.get('verified'), 5);
  if (verified && !['0', '1', 'all'].includes(verified)) throw new AdminQueryError('Filtrul de verificare este invalid.');
  const conditions: string[] = [activeAccountSql(db,'u.id')], args: unknown[] = [];
  if (q) {
    conditions.push(`(f.id LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR f.cui LIKE ? ESCAPE '\\' OR f.coverage_city LIKE ? ESCAPE '\\')`);
    args.push(...Array(4).fill(like(q)));
  }
  if (city) {conditions.push('f.coverage_city=?'); args.push(city);}
  if (verified && verified !== 'all') {conditions.push('f.verified=?'); args.push(Number(verified));}
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const from = ' FROM firms f JOIN users u ON u.id=f.user_id';
  return db.transaction(() => {
    const total = (db.prepare('SELECT COUNT(*) AS n' + from + where).get(...args) as {n: number}).n;
    const firms = db.prepare(`SELECT f.id,u.name,f.coverage_city,f.cui,f.rating_sum,f.rating_count,
      f.strikes_30d,f.strikes_90d,f.suspended_until,f.verified` + from + where + ' ORDER BY u.name,f.id LIMIT ? OFFSET ?')
      .all(...args, LIMIT, pageOffset);
    return {firms, total, hasMore: pageOffset + firms.length < total, offset: pageOffset, limit: LIMIT};
  })();
}
