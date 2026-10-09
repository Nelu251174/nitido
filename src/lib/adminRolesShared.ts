export const ADMIN_ROLES = { operator: 'Operator NITIDO', manager: 'Manager operațional', finance: 'Financiar', super_admin: 'Super Admin' } as const;
export type AdminRole = keyof typeof ADMIN_ROLES;
export type AdminPermission = 'incidents' | 'session' | 'operations' | 'manage' | 'finance' | 'reports' | 'super_admin';
const grants: Record<AdminRole, readonly AdminPermission[]> = { operator: ['incidents', 'session', 'operations'], manager: ['incidents', 'session', 'operations', 'manage', 'reports'], finance: ['incidents', 'session', 'finance', 'reports'], super_admin: ['incidents', 'session', 'operations', 'manage', 'finance', 'reports', 'super_admin'] };
export function hasAdminPermission(role: AdminRole, permission: AdminPermission) { return grants[role]?.includes(permission) ?? false; }
export type AdminIdentity = {
    id: string;
    email: string;
    role: AdminRole;
    revision: number;
};
