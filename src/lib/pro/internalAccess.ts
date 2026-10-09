import { hasAdminPermission, type AdminRole } from '../adminRolesShared';

export function internalProPermissions(role: AdminRole) {
  return {
    operations: hasAdminPermission(role, 'operations'),
    manage: hasAdminPermission(role, 'manage'),
    finance: hasAdminPermission(role, 'finance'),
    reports: hasAdminPermission(role, 'reports'),
    super_admin: hasAdminPermission(role, 'super_admin'),
  };
}

/** Keep the existing Pro principal contract behind a default-deny HTTP adapter. */
export function internalProAllowed(role: AdminRole, method: 'GET' | 'POST', segments: string[]) {
  if (!hasAdminPermission(role, 'session')) return false;
  const p = internalProPermissions(role), [kind, id, action] = segments;
  if (p.super_admin) return true;
  if (segments.length > 3) return false;
  if (method === 'GET') {
    if (segments.length === 1 && ['context', 'notifications'].includes(kind)) return true;
    if (kind === 'dashboard' && segments.length === 1) return true;
    if (kind === 'reports' && id === 'export' && !action) return p.reports;
    if (kind === 'costs' && !id) return p.reports;
    if (kind === 'work-orders') return action ? action === 'credential' && !!id && p.operations : true;
    if (kind === 'properties') return action ? action === 'checklist-history' && !!id && p.operations : true;
    if (kind === 'tickets' && !action) return p.operations;
    if (kind === 'recurring' && !id) return p.operations;
    if (kind === 'approvals' && !id) return true;
    if (kind === 'partners' && !id) return p.operations;
    if (kind === 'media' && !!id && !action) return p.operations;
    if (kind === 'leads' && !id) return p.operations;
    if (kind === 'team' && !id) return p.manage;
    return false;
  }
  if (kind === 'costs' && !!id && !action) return p.finance;
  if (kind === 'notifications' && !!id && !action) return true;
  if (kind === 'work-orders') {
    if (!id) return p.manage;
    if (['reschedule', 'offer', 'rework', 'cancel'].includes(action)) return p.operations;
    if (['quote', 'complete'].includes(action)) return p.manage;
    // Partner execution and client approval stay reserved to their existing identities.
    return false;
  }
  if (kind === 'tickets') return (p.operations && ((!id && !action) || (!!id && action === 'transition'))) || (p.manage && !!id && action === 'create-work');
  if (kind === 'properties') return p.manage && (!id || ['update', 'checklist', 'credential'].includes(action));
  if (kind === 'recurring') return p.manage && (!action || action === 'skip');
  if (['partners', 'leads'].includes(kind)) return p.manage && !action && (!!id || kind === 'partners');
  if (kind === 'media' && !id) return p.operations;
  return false;
}

const moneyFields = new Set(['estimate', 'final_cost', 'threshold', 'threshold_snapshot', 'amount', 'invoice_ref', 'contract_ref', 'payload_json']);
const sensitiveFields = new Set(['address', 'instructions', 'postal_code', 'floor', 'encrypted_value', 'credential', 'payload_json', 'description', 'checklist_json', 'checklist_configuration', 'answers_json', 'review_note', 'media']);
/** Applies to details, collections and context equally, including nested approvals. */
export function internalProView<T>(data: T, role?: AdminRole): T {
  if (!role || role === 'super_admin') return data;
  const permissions = internalProPermissions(role);
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value === null || typeof value !== 'object') return value;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if ((!permissions.reports && moneyFields.has(key)) || (!permissions.operations && sensitiveFields.has(key))) continue;
      result[key] = walk(child);
    }
    if ('permissions' in result && result.permissions && typeof result.permissions === 'object') {
      result.permissions = {
        ...result.permissions,
        manage: permissions.manage,
        operator: permissions.operations,
        approve: false,
        partner: false,
        offer: false,
      };
    }
    return result;
  };
  return walk(data) as T;
}
