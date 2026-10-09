import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ADMIN_ROLES, type AdminRole, type AdminIdentity } from './adminRolesShared';
import { getAdminSecurityConfig, type AdminSecurityConfig } from './adminMfa';
export const ADMIN_STAFF_SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_staff(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('operator','manager','finance','super_admin')),active INTEGER NOT NULL CHECK(active IN (0,1)),revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_staff_history(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES admin_staff(id),revision INTEGER NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(account_id,revision));
CREATE TABLE IF NOT EXISTS admin_session_identity(token_hash TEXT PRIMARY KEY REFERENCES admin_sessions(token_hash) ON DELETE CASCADE,account_id TEXT NOT NULL REFERENCES admin_staff(id),revision INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS admin_staff_history_no_update BEFORE UPDATE ON admin_staff_history BEGIN SELECT RAISE(ABORT,'Staff history immutable'); END;
CREATE TRIGGER IF NOT EXISTS admin_staff_history_no_delete BEFORE DELETE ON admin_staff_history BEGIN SELECT RAISE(ABORT,'Staff history retained'); END;
`;
export class AdminStaffError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
// Secrets stay in deployment configuration, never in account records, HTTP responses or audit.
export function staffCredentials(env: Readonly<Record<string, string | undefined>> = process.env): Map<string, AdminSecurityConfig> {
    const result = new Map<string, AdminSecurityConfig>();
    try {
        const entries = JSON.parse(env.NITIDO_ADMIN_STAFF_ACCOUNTS_JSON ?? '[]');
        if (!Array.isArray(entries) || entries.length > 100)
            return result;
        const secrets = new Set<string>();
        const bootstrap = getAdminSecurityConfig(env);
        if (bootstrap)
            secrets.add(bootstrap.secret.toString('hex'));
        for (const e of entries) {
            if (!e || typeof e.email !== 'string' || typeof e.passwordHash !== 'string' || !/^\$2[aby]\$(1[0-6])\$[./A-Za-z0-9]{53}$/.test(e.passwordHash) || typeof e.totpSecret !== 'string' || (e.recoveryHashes !== undefined && typeof e.recoveryHashes !== 'string'))
                return new Map();
            const c = getAdminSecurityConfig({ NITIDO_ADMIN_EMAIL: e.email, NITIDO_ADMIN_PASSWORD_HASH: e.passwordHash, NITIDO_ADMIN_TOTP_SECRET: e.totpSecret, NITIDO_ADMIN_RECOVERY_HASHES: e.recoveryHashes });
            if (!c || result.has(c.email) || c.email === bootstrap?.email || secrets.has(c.secret.toString('hex')))
                return new Map();
            secrets.add(c.secret.toString('hex'));
            result.set(c.email, c);
        }
    }
    catch {
        return new Map();
    }
    return result;
}
export function adminAccountForEmail(db: Database, email: string): {
    identity: AdminIdentity;
    config: AdminSecurityConfig;
} | null {
    const normalized = email.trim().toLowerCase(), bootstrap = getAdminSecurityConfig();
    if (!bootstrap)
        return null;
    if (normalized === bootstrap.email)
        return { identity: { id: 'bootstrap_admin', email: normalized, role: 'super_admin', revision: 0 }, config: bootstrap };
    const row = db.prepare('SELECT id,email,role,revision FROM admin_staff WHERE email=? AND active=1').get(normalized) as AdminIdentity | undefined;
    const config = staffCredentials().get(normalized);
    return row && config ? { identity: row, config } : null;
}
export function saveAdminStaff(db: Database, b: Record<string, unknown>, actor: AdminIdentity) {
    if (!db.inTransaction || actor.role !== 'super_admin')
        throw new AdminStaffError('Acces Super Admin obligatoriu.', 403);
    if (typeof b.email !== 'string' || b.email.length > 254 || !/^\S+@\S+\.\S+$/.test(b.email.trim()))
        throw new AdminStaffError('Adresă email invalidă.');
    const email = b.email.trim().toLowerCase();
    if (email === getAdminSecurityConfig()?.email)
        throw new AdminStaffError('Contul principal se gestionează prin configurația securizată.', 409);
    if (typeof b.role !== 'string' || !Object.hasOwn(ADMIN_ROLES, b.role) || typeof b.active !== 'boolean' || typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 2000)
        throw new AdminStaffError('Rol, stare și motiv valide sunt obligatorii.');
    const old = db.prepare('SELECT id,revision FROM admin_staff WHERE email=?').get(email) as {
        id: string;
        revision: number;
    } | undefined;
    if (b.revision !== (old?.revision ?? 0))
        throw new AdminStaffError('Contul a fost modificat. Reîncarcă.', 409);
    if (old?.id === actor.id)
        throw new AdminStaffError('Propriul rol nu poate fi modificat din această sesiune.', 409);
    const id = old?.id ?? randomUUID(), revision = (old?.revision ?? 0) + 1;
    db.prepare('INSERT INTO admin_staff VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=excluded.active,revision=excluded.revision').run(id, email, b.role, Number(b.active), revision);
    db.prepare('INSERT INTO admin_staff_history VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(), id, revision, email, b.role, Number(b.active), b.reason.trim(), actor.id, new Date().toISOString());
    db.prepare('DELETE FROM admin_sessions WHERE token_hash IN (SELECT token_hash FROM admin_session_identity WHERE account_id=?)').run(id);
    return { id, email, role: b.role as AdminRole, active: b.active, revision };
}
