import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { initializeDatabase } from './db';
import { adminAccountForEmail } from './adminStaff';
import { getAdminSecurityConfig, totpAt } from './adminMfa';
import { adminPasswordRecoveryEnabled } from './adminPasswordCredentials';
import { activateAdminPasswordReset, applyAdminPasswordReset, consumeAdminRecoveryLimit, discardAdminPasswordReset, issueAdminPasswordReset, validAdminPasswordReset } from './adminPasswordReset';

let db: Database.Database;
const now = Date.parse('2026-10-24T15:00:00Z'), email = 'owner@example.test', recovery = '1234567890abcdef1234567890abcdef';
const passwordHash = bcrypt.hashSync('New-test-password-2026', 12);
const otp = () => totpAt(getAdminSecurityConfig()!.secret, Math.floor(now / 30000));
const issue = () => { const data = issueAdminPasswordReset(db, email, now)!; expect(activateAdminPasswordReset(db, data.token, now)).toBe(true); return data.token; };
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sandbox.nitido.ro'); vi.stubEnv('NITIDO_ADMIN_EMAIL', email); vi.stubEnv('NITIDO_ADMIN_PASSWORD', 'old-password'); vi.stubEnv('NITIDO_ADMIN_PASSWORD_HASH', '');
  vi.stubEnv('NITIDO_ADMIN_TOTP_SECRET', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'); vi.stubEnv('NITIDO_ADMIN_RECOVERY_HASHES', createHash('sha256').update(recovery).digest('hex')); vi.stubEnv('NITIDO_ADMIN_STAFF_ACCOUNTS_JSON', '[]');
  db = new Database(':memory:'); db.pragma('foreign_keys=ON'); initializeDatabase(db);
});
afterEach(() => { db.close(); vi.unstubAllEnvs(); });
describe('ADMIN recovery link lifecycle', () => {
  it('is enabled in sandbox and fails closed on LIVE or a spoofed hostname', () => {
    for (const url of ['', 'https://nitido.ro', 'https://sandbox.nitido.ro.evil.test', 'https://u:p@sandbox.nitido.ro', 'http://localhost']) expect(adminPasswordRecoveryEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: url })).toBe(false);
    expect(adminPasswordRecoveryEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://sandbox.nitido.ro' })).toBe(true);
  });
  it('issues links only for configured active ADMIN accounts and stores hashes', () => {
    expect(issueAdminPasswordReset(db, 'client@example.test', now)).toBeNull();
    const data = issueAdminPasswordReset(db, email, now)!;
    expect(validAdminPasswordReset(db, data.token, now)).toBeNull();
    expect(JSON.stringify(db.prepare('SELECT * FROM admin_password_reset_tokens').all())).not.toContain(data.token);
    expect(activateAdminPasswordReset(db, data.token, now)).toBe(true);
    expect(validAdminPasswordReset(db, data.token, now + 15 * 60000)).toBeNull();
  });
  it('keeps an accepted older link usable if a later email cannot be sent', () => {
    const first = issue(), failed = issueAdminPasswordReset(db, email, now + 1)!;
    discardAdminPasswordReset(db, failed.token);
    expect(validAdminPasswordReset(db, first, now + 2)).not.toBeNull();
    expect(validAdminPasswordReset(db, failed.token, now + 2)).toBeNull();
  });
  it('activates the latest delivered link and handles out-of-order email completion', () => {
    const first = issueAdminPasswordReset(db, email, now)!, second = issueAdminPasswordReset(db, email, now)!;
    expect(activateAdminPasswordReset(db, second.token, now + 10)).toBe(true);
    expect(activateAdminPasswordReset(db, first.token, now + 20)).toBe(false);
    expect(validAdminPasswordReset(db, second.token, now + 20)).not.toBeNull();
  });
  it('applies persistent per-account request limits independently of caller IPs', () => {
    for (let i = 0; i < 3; i++) expect(issueAdminPasswordReset(db, email, now)).not.toBeNull();
    expect(issueAdminPasswordReset(db, email, now)).toBeNull();
    expect(issueAdminPasswordReset(db, email, now + 15 * 60000)).not.toBeNull();
    expect(consumeAdminRecoveryLimit(db, 'same-key', 1, 1000, now)).toBe(true);
    expect(consumeAdminRecoveryLimit(db, 'same-key', 1, 1000, now)).toBe(false);
  });
});
describe('password change keeps MFA and administrative identity intact', () => {
  it('rejects missing/invalid factors without changing credentials or consuming the link', () => {
    const token = issue();
    expect(applyAdminPasswordReset(db, token, passwordHash, '000000', 'totp', now)).toBe(false);
    expect(validAdminPasswordReset(db, token, now)).not.toBeNull();
    expect(adminAccountForEmail(db, email)!.config.passwordPlain).toBe('old-password');
  });
  it('changes only the ADMIN password and revokes every existing session of that account', () => {
    const token = issue(), binding = adminAccountForEmail(db, email)!.config.binding;
    db.prepare("INSERT INTO admin_sessions(id,token_hash,expires_at) VALUES('session','session-hash','2099-01-01')").run();
    db.prepare("INSERT INTO admin_session_mfa VALUES('session-hash',?,?, 'totp')").run(binding, now);
    expect(applyAdminPasswordReset(db, token, passwordHash, otp(), 'totp', now)).toBe(true);
    const config = adminAccountForEmail(db, email)!.config;
    expect(config.passwordPlain).toBe(''); expect(config.passwordHash).toBe(passwordHash); expect(config.binding).not.toBe(binding);
    expect(config.secret).toEqual(getAdminSecurityConfig()!.secret);
    expect(db.prepare('SELECT * FROM admin_sessions').all()).toEqual([]);
    expect(applyAdminPasswordReset(db, token, passwordHash, otp(), 'totp', now)).toBe(false);
    expect(db.prepare('SELECT COUNT(*) n FROM users').get()).toEqual({ n: 0 });
    const audit = JSON.stringify(db.prepare('SELECT * FROM admin_audit_log').all());
    expect(audit).toContain('ADMIN_PASSWORD_RESET'); expect(audit).not.toContain(token); expect(audit).not.toContain(passwordHash); expect(audit).not.toContain(otp());
  });
  it('accepts one-use recovery codes without disabling the TOTP configuration', () => {
    const token = issue(); expect(applyAdminPasswordReset(db, token, passwordHash, recovery, 'recovery', now)).toBe(true);
    const second = issue(); expect(applyAdminPasswordReset(db, second, passwordHash, recovery, 'recovery', now)).toBe(false);
    expect(adminAccountForEmail(db, email)!.config.secret.length).toBe(20);
  });
  it('rejects token reuse and factor replay across different recovery links', () => {
    expect(applyAdminPasswordReset(db, issue(), passwordHash, otp(), 'totp', now)).toBe(true);
    const second = issue(); expect(applyAdminPasswordReset(db, second, passwordHash, otp(), 'totp', now)).toBe(false);
  });
  it('invalidates pending links on infrastructure rotation and ignores stale password overrides', () => {
    const token = issue(); vi.stubEnv('NITIDO_ADMIN_PASSWORD', 'rotated');
    expect(applyAdminPasswordReset(db, token, passwordHash, otp(), 'totp', now)).toBe(false);
    vi.stubEnv('NITIDO_ADMIN_PASSWORD', 'old-password'); expect(applyAdminPasswordReset(db, token, passwordHash, otp(), 'totp', now)).toBe(true);
    vi.stubEnv('NITIDO_ADMIN_PASSWORD', 'operator-new-password');
    expect(adminAccountForEmail(db, email)!.config.passwordPlain).toBe('operator-new-password');
  });
  it('rolls back password, link, session revocation and factor consumption on audit failure', () => {
    const token = issue(); db.exec("CREATE TRIGGER reject_reset_audit BEFORE INSERT ON admin_audit_log BEGIN SELECT RAISE(ABORT,'test audit error'); END");
    expect(() => applyAdminPasswordReset(db, token, passwordHash, otp(), 'totp', now)).toThrow();
    expect(validAdminPasswordReset(db, token, now)).not.toBeNull(); expect(db.prepare('SELECT * FROM admin_password_credentials').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM admin_totp_state').all()).toEqual([]);
    db.exec('DROP TRIGGER reject_reset_audit'); expect(applyAdminPasswordReset(db, token, passwordHash, otp(), 'totp', now)).toBe(true);
  });
  it('respects staff identity, role revision and deactivation during recovery', () => {
    const staffEmail = 'staff@example.test';
    vi.stubEnv('NITIDO_ADMIN_STAFF_ACCOUNTS_JSON', JSON.stringify([{ email: staffEmail, passwordHash, totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' }]));
    db.prepare("INSERT INTO admin_staff VALUES('staff',?,'operator',1,1)").run(staffEmail);
    const reset = issueAdminPasswordReset(db, staffEmail, now)!; activateAdminPasswordReset(db, reset.token, now);
    db.exec("UPDATE admin_staff SET revision=2 WHERE id='staff'");
    expect(validAdminPasswordReset(db, reset.token, now)).toBeNull();
    db.exec("UPDATE admin_staff SET active=0 WHERE id='staff'");
    expect(issueAdminPasswordReset(db, staffEmail, now)).toBeNull();
  });
});
