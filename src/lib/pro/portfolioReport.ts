import type { Database } from 'better-sqlite3';
import type { AdminRole } from '../adminRolesShared';
import { hasAdminPermission } from '../adminRolesShared';
import { bucharestDateKey } from '../scheduling';
import { organization, fail, allowed, type Principal } from './core';
import { SERVICES } from './shared';
import { proReportPeriod, proReportTimestamp } from './reportPeriod';

export type PortfolioFilters = { from?: string; to?: string; property?: string; category?: string; property_page?: string };
type ReportPrincipal = Principal & { internalRole?: AdminRole };
type Numbers = Record<string, number>;
const roleList = "'owner','manager','approver','viewer','contact','operator'";
const moneyRoleList = "'owner','manager','operator'";

/** Aggregate before pagination. Every query shares one read snapshot and the same server-side scope. */
export function portfolioReport(db: Database, p: ReportPrincipal, org: string, filters: PortfolioFilters = {}, stamp = Date.now()) {
  organization(db, p, org);
  const today = bucharestDateKey(new Date(stamp));
  let period;
  try { period = proReportPeriod(filters.from || today.slice(0, 8) + '01', filters.to || today); }
  catch (e) { fail(e instanceof Error ? e.message : 'Perioadă invalidă.'); }
  const selectedProperty = filters.property ?? '', category = filters.category ?? '';
  if (category && !Object.hasOwn(SERVICES, category)) fail('Categorie de serviciu invalidă.');
  const pageText = filters.property_page || '0';
  if (!/^\d{1,7}$/.test(pageText)) fail('Pagina proprietăților este invalidă.');
  const page = Number(pageText), pageSize = 100;
  if (selectedProperty) {
    const match = db.prepare('SELECT 1 FROM pro_properties WHERE organization_id=? AND id=?').get(org, selectedProperty);
    if (!match || !(p.admin || allowed(db, p, org, ['owner','manager','approver','viewer','contact','operator'], selectedProperty))) fail('Proprietate inexistentă.', 404);
  }
  const internalMoney = p.admin && (!p.internalRole || hasAdminPermission(p.internalRole, 'reports'));
  const hasClientMoney = internalMoney || (!p.admin && db.prepare(`SELECT 1 FROM pro_members WHERE organization_id=? AND user_id=? AND active=1 AND role IN (${moneyRoleList})`).get(org, p.id));
  const memberScope = (roles: string) => `EXISTS(SELECT 1 FROM pro_members m WHERE m.organization_id=p.organization_id AND m.user_id=@actor AND m.active=1 AND m.role IN (${roles}) AND (m.role='owner' OR json_array_length(m.scope_json)=0 OR EXISTS(SELECT 1 FROM json_each(m.scope_json) j WHERE j.value=p.id)))`;
  const timeWork = proReportTimestamp('w.starts_at'), timeCost = proReportTimestamp('c.created_at');
  const bounds = (expression: string) => `${expression}>=julianday(@start) AND ${expression}<julianday(@end)`;
  const params = { org, actor: p.id, property: selectedProperty, category, start: period.startsAt!, end: period.endsBefore!, from: period.from, to: period.to, limit: pageSize, offset: page * pageSize };
  const ctes = `WITH visible_properties AS (
    SELECT p.id,p.name,p.status,p.organization_id FROM pro_properties p
    WHERE p.organization_id=@org AND (@property='' OR p.id=@property) AND ${p.admin ? '1' : memberScope(roleList)}
  ), financial_properties AS (
    SELECT p.* FROM visible_properties p WHERE ${internalMoney ? '1' : p.admin ? '0' : memberScope(moneyRoleList)}
  ), selected_work AS (
    SELECT w.* FROM pro_work_orders w JOIN visible_properties p ON p.id=w.property_id
    WHERE w.organization_id=@org AND (@category='' OR w.service=@category) AND ${bounds(timeWork)}
  ), selected_cost AS (
    SELECT c.* FROM pro_cost_entries c WHERE c.organization_id=@org
    AND (c.property_id IN (SELECT id FROM financial_properties) OR (c.property_id IS NULL AND @property='' AND @org_money=1))
    AND (@category='' OR c.category=@category) AND ${bounds(timeCost)}
  ), selected_occurrences AS (
    SELECT o.*,r.property_id FROM pro_occurrences o JOIN pro_recurring_rules r ON r.id=o.rule_id JOIN visible_properties p ON p.id=r.property_id
    WHERE r.organization_id=@org AND (@category='' OR r.service=@category) AND o.day>=@from AND o.day<=@to
  )`;
  const orgMoney = Boolean(internalMoney || (!p.admin && allowed(db, p, org, ['owner','manager','operator'], null)));
  const bindings = { ...params, org_money: orgMoney ? 1 : 0 };
  // Named bindings may include unused parameters in better-sqlite3; no user SQL is interpolated.
  const get = (query: string) => db.prepare(ctes + query).get(bindings) as Numbers;
  const all = <T>(query: string) => db.prepare(ctes + query).all(bindings) as T[];
  return db.transaction(() => {
    const properties = get(`SELECT COUNT(*) total,COALESCE(SUM(status='active'),0) active,COALESCE(SUM(status<>'active'),0) inactive FROM visible_properties`);
    const work = get(`SELECT COUNT(*) total,COALESCE(SUM(status='completed'),0) completed,COALESCE(SUM(status='cancelled'),0) cancelled,
      COALESCE(SUM(status='scheduled'),0) scheduled,COALESCE(SUM(status='offered'),0) offered,COALESCE(SUM(status='accepted'),0) accepted,
      COALESCE(SUM(status='in_progress'),0) inProgress,COALESCE(SUM(status='submitted_for_review'),0) awaitingReview,
      COALESCE(SUM(status='rework_requested'),0) rework,COALESCE(SUM(EXISTS(SELECT 1 FROM pro_occurrences o WHERE o.work_order_id=w.id)),0) recurring FROM selected_work w`);
    const approvals = get(`SELECT COUNT(*) current,COALESCE(SUM(a.decision='pending'),0) pending,COALESCE(SUM(a.decision='approved'),0) approved,
      COALESCE(SUM(a.decision='rejected'),0) rejected,COALESCE(SUM(a.decision='changes_requested'),0) clarification
      FROM pro_approvals a JOIN selected_work w ON w.id=a.work_order_id AND w.quote_version=a.quote_version WHERE a.organization_id=@org AND a.decision<>'superseded'`);
    approvals.missingCurrent = get(`SELECT COUNT(*) missing FROM selected_work w WHERE w.financial_status<>'not_required'
      AND NOT EXISTS(SELECT 1 FROM pro_approvals a WHERE a.organization_id=@org AND a.work_order_id=w.id AND a.quote_version=w.quote_version AND a.decision<>'superseded')`).missing;
    const occurrences = get(`SELECT COUNT(*) total,COALESCE(SUM(status='generated'),0) generated,COALESCE(SUM(status='skipped'),0) skipped,COALESCE(SUM(status='missed'),0) missed FROM selected_occurrences`);
    const daily = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pro_recurring_cadences'").get();
    const rules = get(`SELECT COUNT(*) total,COALESCE(SUM(${daily ? 'COALESCE(c.active,r.active)' : 'r.active'}=1),0) active,
      COALESCE(SUM(${daily ? 'COALESCE(c.active,r.active)' : 'r.active'}=0),0) paused
      FROM pro_recurring_rules r JOIN visible_properties p ON p.id=r.property_id${daily ? ' LEFT JOIN pro_recurring_cadences c ON c.rule_id=r.id' : ''}
      WHERE r.organization_id=@org AND (@category='' OR r.service=@category)`);
    const unknownDates = get(`SELECT
      (SELECT COUNT(*) FROM pro_work_orders w JOIN visible_properties p ON p.id=w.property_id WHERE w.organization_id=@org AND (@category='' OR w.service=@category) AND ${timeWork} IS NULL) workOrders,
      (SELECT COUNT(*) FROM pro_cost_entries c WHERE c.organization_id=@org AND (c.property_id IN (SELECT id FROM financial_properties) OR (c.property_id IS NULL AND @property='' AND @org_money=1)) AND (@category='' OR c.category=@category) AND ${timeCost} IS NULL) costEntries`);
    const financeScope = get('SELECT COUNT(*) properties FROM financial_properties');
    const canMoney = Boolean(hasClientMoney && (financeScope.properties > 0 || orgMoney));
    const validMoney = "typeof(c.amount)='integer' AND c.amount>=0 AND c.currency='RON'";
    const ledger = canMoney ? get(`SELECT COUNT(*) entries,COALESCE(SUM(CASE WHEN ${validMoney} THEN c.amount ELSE 0 END),0) knownBani,
      COALESCE(SUM(NOT(${validMoney})),0) unknownEntries FROM selected_cost c`) : null;
    const finalCosts = canMoney ? get(`SELECT COUNT(*) completed,
      COALESCE(SUM(CASE WHEN typeof(w.final_cost)='integer' AND w.final_cost>=0 AND w.financial_status IN ('approved','not_required') THEN w.final_cost ELSE 0 END),0) knownBani,
      COALESCE(SUM(typeof(w.final_cost)<>'integer' OR w.final_cost<0 OR w.financial_status NOT IN ('approved','not_required')),0) unknownWorks,
      COALESCE(SUM(NOT EXISTS(SELECT 1 FROM pro_cost_entries c WHERE c.organization_id=@org AND c.work_order_id=w.id)),0) missingRegistry
      FROM selected_work w JOIN financial_properties p ON p.id=w.property_id WHERE w.status='completed'`) : null;
    for (const amount of [ledger?.knownBani, finalCosts?.knownBani]) if (amount !== undefined && !Number.isSafeInteger(amount)) fail('Totalul financiar depășește limita sigură a raportului.');
    const propertyRows = all<{ id: string; name: string; status: string; works: number; completed: number; pendingApprovals: number; recurringWorks: number; missedOccurrences: number; financialAccess: number; costEntries: number; knownCostBani: number; unknownCostEntries: number; unknownCostDates: number }>(`
      SELECT p.id,p.name,p.status,
      (SELECT COUNT(*) FROM selected_work w WHERE w.property_id=p.id) works,
      (SELECT COUNT(*) FROM selected_work w WHERE w.property_id=p.id AND w.status='completed') completed,
      (SELECT COUNT(*) FROM pro_approvals a JOIN selected_work w ON w.id=a.work_order_id AND w.quote_version=a.quote_version WHERE w.property_id=p.id AND a.decision='pending') pendingApprovals,
      (SELECT COUNT(*) FROM selected_work w WHERE w.property_id=p.id AND EXISTS(SELECT 1 FROM pro_occurrences o WHERE o.work_order_id=w.id)) recurringWorks,
      (SELECT COUNT(*) FROM selected_occurrences o WHERE o.property_id=p.id AND o.status='missed') missedOccurrences,
      EXISTS(SELECT 1 FROM financial_properties f WHERE f.id=p.id) financialAccess,
      (SELECT COUNT(*) FROM selected_cost c WHERE c.property_id=p.id) costEntries,
      (SELECT COALESCE(SUM(CASE WHEN ${validMoney} THEN c.amount ELSE 0 END),0) FROM selected_cost c WHERE c.property_id=p.id) knownCostBani,
      (SELECT COUNT(*) FROM selected_cost c WHERE c.property_id=p.id AND NOT(${validMoney})) unknownCostEntries
      ,(SELECT COUNT(*) FROM pro_cost_entries c WHERE c.organization_id=@org AND c.property_id=p.id AND (@category='' OR c.category=@category) AND ${timeCost} IS NULL) unknownCostDates
      FROM visible_properties p ORDER BY p.name,p.id LIMIT @limit OFFSET @offset`);
    const attentionWork = all<{ id: string; title: string; starts_at: string; status: string; property_name: string }>(`
      SELECT w.id,w.title,w.starts_at,w.status,p.name property_name FROM selected_work w JOIN visible_properties p ON p.id=w.property_id
      WHERE w.status NOT IN ('completed','cancelled') ORDER BY w.starts_at,w.id LIMIT 8`)
      .map(({ property_name, ...row }) => ({ ...row, property: { name: property_name } }));
    const nextPage = (page + 1) * pageSize < properties.total ? page + 1 : null;
    return {
      organizationId: org, period, filters: { property: selectedProperty, category },
      cohorts: { work: 'starts_at', approvals: 'current_quote_for_selected_work', costs: 'registry_created_at', occurrences: 'nominal_local_day', rules: 'current_inventory', properties: 'current_authorized_inventory' },
      properties, work, approvals, recurrence: { workOrders: work.recurring, occurrences, rules },
      completeness: { workComplete: !unknownDates.workOrders, unknownWorkDates: unknownDates.workOrders, unknownCostDates: canMoney ? unknownDates.costEntries : null },
      clientCosts: ledger && finalCosts ? {
        currency: 'RON', scope: { properties: financeScope.properties, organizationEntries: orgMoney },
        registry: { entries: ledger.entries, knownBani: ledger.knownBani, unknownEntries: ledger.unknownEntries, totalBani: ledger.unknownEntries || unknownDates.costEntries ? null : ledger.knownBani, complete: !ledger.unknownEntries && !unknownDates.costEntries },
        completedWork: { completed: finalCosts.completed, knownBani: finalCosts.knownBani, unknownWorks: finalCosts.unknownWorks, missingRegistry: finalCosts.missingRegistry, totalBani: finalCosts.unknownWorks ? null : finalCosts.knownBani, complete: !finalCosts.unknownWorks },
      } : null,
      ...(internalMoney ? { internalMargin: { available: false, totalBani: null, reason: 'Registrul Pro nu conține baza distinctă de venit și costuri directe NITIDO; marja nu este calculabilă.' } } : {}),
      propertyRows: propertyRows.map(({ financialAccess, costEntries, knownCostBani, unknownCostEntries, unknownCostDates, ...row }) => ({ ...row,
        clientCosts: financialAccess && canMoney ? { entries: costEntries, knownBani: knownCostBani, totalBani: unknownCostEntries || unknownCostDates ? null : knownCostBani, unknownEntries: unknownCostEntries, unknownDates: unknownCostDates } : null,
      })),
      attentionWork,
      pagination: { page, pageSize, totalProperties: properties.total, returnedProperties: propertyRows.length, nextPage, aggregatesCoverAllAuthorizedProperties: true },
    };
  }).deferred();
}
