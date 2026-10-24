import type { Database } from 'better-sqlite3';
import { randomBytes, createHash } from 'node:crypto';
import { adminAccountForEmail } from './adminStaff';
import { consumeAdminFactor, type AdminFactorMethod } from './adminMfa';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const LIFETIME = 15 * 60000;
type TokenRow = { token_hash: string; account_id: string; email: string; auth_binding: string; identity_revision: number; created_ms: number; expires_ms: number; used_ms: number | null; ready: number };

export function consumeAdminRecoveryLimit(db: Database, key: string, limit: number, windowMs: number, now = Date.now()) {
  return db.transaction(() => {
    const keyHash = hash(key);
    const row = db.prepare('SELECT attempts,reset_ms FROM admin_password_recovery_limits WHERE key_hash=?').get(keyHash) as { attempts: number; reset_ms: number } | undefined;
    if (!row || row.reset_ms <= now) {
      db.prepare(`INSERT INTO admin_password_recovery_limits VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=1,reset_ms=excluded.reset_ms`).run(keyHash, now + windowMs);
      return true;
    }
    if (row.attempts >= limit) return false;
    db.prepare('UPDATE admin_password_recovery_limits SET attempts=attempts+1 WHERE key_hash=?').run(keyHash);
    return true;
  }).immediate();
}

export function issueAdminPasswordReset(db: Database, email: string, now = Date.now()): { token: string; email: string; accountId: string } | null {
  const account = adminAccountForEmail(db, email);
  if (!account || !consumeAdminRecoveryLimit(db, `request:${account.identity.id}`, 3, LIFETIME, now)) return null;
  const token = randomBytes(32).toString('hex');
  db.transaction(() => {
    db.prepare('DELETE FROM admin_password_reset_tokens WHERE expires_ms<=?').run(now);
    const previous = db.prepare('SELECT MAX(created_ms) created_ms FROM admin_password_reset_tokens WHERE account_id=?').get(account.identity.id) as { created_ms: number | null };
    const created = Math.max(now, (previous.created_ms ?? now - 1) + 1);
    db.prepare(`INSERT INTO admin_password_reset_tokens(token_hash,account_id,email,auth_binding,identity_revision,created_ms,expires_ms) VALUES(?,?,?,?,?,?,?)`)
      .run(hash(token), account.identity.id, account.identity.email, account.config.binding, account.identity.revision, created, now + LIFETIME);
  })();
  return { token, email: account.identity.email, accountId: account.identity.id };
}

export function activateAdminPasswordReset(db: Database, token: string, now = Date.now()): boolean {
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM admin_password_reset_tokens WHERE token_hash=? AND used_ms IS NULL AND expires_ms>? AND ready=0').get(hash(token), now) as TokenRow | undefined;
    if (!row) return false;
    const account = adminAccountForEmail(db, row.email);
    if (!matches(row, account)) return false;
    // A slower earlier request cannot invalidate a newer link that has already been sent.
    const newer = db.prepare('SELECT 1 FROM admin_password_reset_tokens WHERE account_id=? AND ready=1 AND used_ms IS NULL AND created_ms>?').get(row.account_id, row.created_ms);
    if (newer) return false;
    db.prepare('UPDATE admin_password_reset_tokens SET used_ms=? WHERE account_id=? AND token_hash<>? AND ready=1 AND used_ms IS NULL').run(now, row.account_id, row.token_hash);
    return db.prepare('UPDATE admin_password_reset_tokens SET ready=1 WHERE token_hash=?').run(row.token_hash).changes === 1;
  }).immediate();
}
export function discardAdminPasswordReset(db: Database, token: string) {
  db.prepare('DELETE FROM admin_password_reset_tokens WHERE token_hash=? AND ready=0').run(hash(token));
}
function matches(row: TokenRow, account: ReturnType<typeof adminAccountForEmail>) {
  return !!account && account.identity.id === row.account_id && account.identity.revision === row.identity_revision && account.config.binding === row.auth_binding;
}
export function validAdminPasswordReset(db: Database, token: string, now = Date.now()): TokenRow | null {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db.prepare('SELECT * FROM admin_password_reset_tokens WHERE token_hash=? AND ready=1 AND used_ms IS NULL AND expires_ms>?').get(hash(token), now) as TokenRow | undefined;
  return row && matches(row, adminAccountForEmail(db, row.email)) ? row : null;
}

/** Password, one-time MFA, link consumption, session revocation and audit commit together. */
export function applyAdminPasswordReset(db: Database, token: string, passwordHash: string, code: string, method: AdminFactorMethod, now = Date.now()): boolean {
  if (!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(passwordHash)) throw Error('INVALID_ADMIN_PASSWORD_HASH');
  return db.transaction(() => {
    const row = validAdminPasswordReset(db, token, now);
    if (!row) return false;
    const account = adminAccountForEmail(db, row.email)!;
    if (!consumeAdminFactor(db, account.config, code, method, now)) return false;
    db.prepare(`INSERT INTO admin_password_credentials(account_id,base_binding,password_hash,revision,updated_ms) VALUES(?,?,?,1,?)
      ON CONFLICT(account_id) DO UPDATE SET base_binding=excluded.base_binding,password_hash=excluded.password_hash,revision=revision+1,updated_ms=excluded.updated_ms`)
      .run(row.account_id, account.baseBinding, passwordHash, now);
    db.prepare('UPDATE admin_password_reset_tokens SET used_ms=? WHERE account_id=? AND used_ms IS NULL').run(now, row.account_id);
    db.prepare('DELETE FROM admin_session_identity WHERE token_hash IN (SELECT token_hash FROM admin_session_mfa WHERE auth_binding=?)').run(account.config.binding);
    db.prepare('DELETE FROM admin_sessions WHERE token_hash IN (SELECT token_hash FROM admin_session_mfa WHERE auth_binding=?)').run(account.config.binding);
    db.prepare('DELETE FROM admin_session_mfa WHERE auth_binding=?').run(account.config.binding);
    db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)')
      .run(randomBytes(16).toString('hex'), 'ADMIN_PASSWORD_RESET', row.account_id, JSON.stringify({ method, sessionsRevoked: true }));
    return true;
  }).immediate();
}
