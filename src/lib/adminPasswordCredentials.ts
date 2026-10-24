import type { Database } from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type { AdminSecurityConfig } from './adminMfa';

export const ADMIN_PASSWORD_RECOVERY_SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_password_credentials (
 account_id TEXT PRIMARY KEY,base_binding TEXT NOT NULL,password_hash TEXT NOT NULL,
 revision INTEGER NOT NULL,updated_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
 token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL,email TEXT NOT NULL,
 auth_binding TEXT NOT NULL,identity_revision INTEGER NOT NULL,
 created_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL,used_ms INTEGER,
 ready INTEGER NOT NULL DEFAULT 0 CHECK(ready IN (0,1))
);
CREATE INDEX IF NOT EXISTS admin_password_reset_account ON admin_password_reset_tokens(account_id,created_ms);
CREATE TABLE IF NOT EXISTS admin_password_recovery_limits (
 key_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_ms INTEGER NOT NULL
);
`;

export function adminPasswordRecoveryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    const url = new URL(env.NEXT_PUBLIC_SITE_URL ?? '');
    if (url.username || url.password) return false;
    return url.origin === 'https://sandbox.nitido.ro' || (env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch { return false; }
}

/** An infrastructure credential/MFA rotation invalidates any database override. */
export function recoveredAdminConfig(db: Database, accountId: string, base: AdminSecurityConfig): AdminSecurityConfig {
  if (!adminPasswordRecoveryEnabled()) return base;
  const override = db.prepare('SELECT base_binding,password_hash,revision FROM admin_password_credentials WHERE account_id=?').get(accountId) as { base_binding: string; password_hash: string; revision: number } | undefined;
  if (!override || override.base_binding !== base.binding) return base;
  return { ...base, passwordPlain: '', passwordHash: override.password_hash,
    binding: createHash('sha256').update(JSON.stringify([base.binding, override.password_hash, override.revision])).digest('hex') };
}
