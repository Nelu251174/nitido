import { hasAdminPermission, type AdminRole } from './adminRolesShared';
import type { CustomerRecord } from './customerOperations';

export function customerPermissions(role: AdminRole) {
  return {
    read: hasAdminPermission(role, 'operations') || hasAdminPermission(role, 'reports'),
    annotate: hasAdminPermission(role, 'operations'),
    restrict: hasAdminPermission(role, 'manage'),
    financial: hasAdminPermission(role, 'finance'),
    value: hasAdminPermission(role, 'reports'),
  };
}

/** Redact on the server before serializing; hiding a panel does not protect its data. */
export function customerRecordView(record: CustomerRecord, role: AdminRole) {
  const permissions = customerPermissions(role);
  return {
    ...record,
    permissions,
    user: { ...record.user, credit_balance: permissions.financial ? record.user.credit_balance : null },
    jobs: {
      ...record.jobs,
      rows: permissions.value ? record.jobs.rows : record.jobs.rows.map(row => {
        const operational = { ...(row as Record<string, unknown>) };
        delete operational.price_gross;
        return operational;
      }),
    },
    payments: permissions.financial ? record.payments : { rows: [], hasMore: false },
    value: {
      ...record.value,
      completedServiceValueBani: permissions.value ? record.value.completedServiceValueBani : null,
      margin: permissions.value ? record.value.margin : null,
    },
  };
}
export type CustomerRecordView = ReturnType<typeof customerRecordView>;
