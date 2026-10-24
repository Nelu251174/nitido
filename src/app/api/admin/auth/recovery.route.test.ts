import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
const state = vi.hoisted(() => ({ values: new Map<string, string>(), configured: vi.fn(), send: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => state.values.has(name) ? { value: state.values.get(name) } : undefined, set: (name: string, value: string) => state.values.set(name, value), delete: (name: string) => state.values.delete(name) }) }));
vi.mock('@/lib/email', () => ({ emailConfigured: state.configured, sendEmail: state.send }));
vi.mock('@/lib/db', async original => {
  const actual = await original<typeof import('@/lib/db')>();
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:'); db.pragma('foreign_keys=ON'); db.exec(actual.SCHEMA_SQL);
  return { ...actual, db };
});
import { db } from '@/lib/db';
import { POST as requestReset } from './forgot-password/route';
import { POST as resetPassword } from './reset-password/route';
import { activateAdminPasswordReset, issueAdminPasswordReset, validAdminPasswordReset } from '@/lib/adminPasswordReset';
import { getAdminSecurityConfig, totpAt } from '@/lib/adminMfa';
import { authenticateAdmin, isAdmin } from '@/lib/adminAuth';

const email = 'owner@example.test', recovery = 'abcdef0123456789abcdef0123456789';
let sequence = 0;
function req(path: string, body: unknown, origin = 'https://sandbox.nitido.ro') {
  return new NextRequest(`https://sandbox.nitido.ro/api/admin/auth/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'x-forwarded-for': `198.51.100.${++sequence}` }, body: JSON.stringify(body) });
}
const token = () => { const issued = issueAdminPasswordReset(db, email)!; activateAdminPasswordReset(db, issued.token); return issued.token; };
const resetBody = (value = token()) => ({ token: value, password: 'New-password-2026', code: recovery, method: 'recovery' });
beforeEach(() => {
  vi.clearAllMocks(); state.values.clear(); state.configured.mockReturnValue(true); state.send.mockResolvedValue(true);
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sandbox.nitido.ro'); vi.stubEnv('NITIDO_ADMIN_EMAIL', email); vi.stubEnv('NITIDO_ADMIN_PASSWORD', 'old-password'); vi.stubEnv('NITIDO_ADMIN_PASSWORD_HASH', ''); vi.stubEnv('NITIDO_ADMIN_TOTP_SECRET', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'); vi.stubEnv('NITIDO_ADMIN_RECOVERY_HASHES', createHash('sha256').update(recovery).digest('hex')); vi.stubEnv('NITIDO_ADMIN_STAFF_ACCOUNTS_JSON', '[]');
  db.exec('DELETE FROM admin_session_identity; DELETE FROM admin_session_mfa; DELETE FROM admin_sessions; DELETE FROM admin_totp_state; DELETE FROM admin_used_recovery_codes; DELETE FROM admin_password_reset_tokens; DELETE FROM admin_password_credentials; DELETE FROM admin_password_recovery_limits; DELETE FROM admin_audit_log;');
});
afterEach(() => vi.unstubAllEnvs());
describe('ADMIN email recovery endpoints', () => {
  it('sends only to the configured account and returns the same response for unknown addresses', async () => {
    const unknown = await requestReset(req('forgot-password', { email: 'unknown@example.test' }));
    expect(state.send).not.toHaveBeenCalled();
    const known = await requestReset(req('forgot-password', { email: 'OWNER@EXAMPLE.TEST' }));
    expect(known.status).toBe(200); expect(await known.json()).toEqual(await unknown.json());
    const sent = state.send.mock.calls[0][0]; expect(sent.to).toBe(email); expect(sent.html).toContain('https://sandbox.nitido.ro/admin/recuperare#');
    const rawToken = sent.html.match(/recuperare#([a-f0-9]{64})/)[1];
    expect(validAdminPasswordReset(db, rawToken)).not.toBeNull();
    expect(JSON.stringify(db.prepare('SELECT * FROM admin_password_reset_tokens').all())).not.toContain(rawToken);
  });
  it('keeps prior accepted links when sending fails and never reports delivery as confirmed', async () => {
    const first = token(); state.send.mockResolvedValue(false);
    const response = await requestReset(req('forgot-password', { email }));
    expect(response.status).toBe(200); expect(validAdminPasswordReset(db, first)).not.toBeNull();
    expect(db.prepare('SELECT COUNT(*) n FROM admin_password_reset_tokens').get()).toEqual({ n: 1 });
  });
  it('reports unconfigured email uniformly without issuing links', async () => {
    state.configured.mockReturnValue(false);
    for (const address of [email, 'unknown@example.test']) expect((await requestReset(req('forgot-password', { email: address }))).status).toBe(503);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('blocks LIVE, untrusted/missing origins and bearer-looking overrides', async () => {
    for (const origin of ['', 'https://evil.test']) {
      const request = req('forgot-password', { email }, origin); request.headers.set('authorization', 'Bearer arbitrary');
      expect((await requestReset(request)).status).toBe(403);
      expect((await resetPassword(req('reset-password', {}, origin))).status).toBe(403);
    }
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://nitido.ro');
    expect((await requestReset(req('forgot-password', { email }))).status).toBe(404);
    expect((await resetPassword(req('reset-password', {}))).status).toBe(404);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('rejects invalid and oversized request bodies before sending', async () => {
    for (const body of [null, {}, { email: 'bad' }, { email: 'a'.repeat(5000) }]) expect((await requestReset(req('forgot-password', body))).status).toBe(400);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('limits repeated account requests even when callers change IPs', async () => {
    for (let i = 0; i < 4; i++) expect((await requestReset(req('forgot-password', { email }))).status).toBe(200);
    expect(state.send).toHaveBeenCalledTimes(3);
  });
  it('requires MFA, revokes the old session and accepts only the new password afterwards', async () => {
    const secret = getAdminSecurityConfig()!.secret, step = Math.floor(Date.now() / 30000);
    expect(await authenticateAdmin(email, 'old-password', totpAt(secret, step), 'totp')).toBe(true);
    const body = resetBody();
    expect((await resetPassword(req('reset-password', { ...body, code: '0'.repeat(32) }))).status).toBe(400);
    expect((await resetPassword(req('reset-password', body))).status).toBe(200);
    expect(await isAdmin()).toBe(false);
    expect(await authenticateAdmin(email, 'old-password', totpAt(secret, step + 1), 'totp')).toBe(false);
    expect(await authenticateAdmin(email, body.password, totpAt(secret, step + 1), 'totp')).toBe(true);
    expect((await resetPassword(req('reset-password', body))).status).toBe(400);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('rejects weak passwords without consuming a valid recovery link', async () => {
    const body = resetBody();
    for (const password of ['short123', 'alllettersbutnodigits', 'é'.repeat(40) + 'A1']) expect((await resetPassword(req('reset-password', { ...body, password }))).status).toBe(400);
    expect(validAdminPasswordReset(db, body.token)).not.toBeNull();
  });
  it('does not permit MFA brute force using a secret link and changing IPs', async () => {
    const body = resetBody();
    for (let i = 0; i < 5; i++) expect((await resetPassword(req('reset-password', { ...body, code: '0'.repeat(32) }))).status).toBe(400);
    expect((await resetPassword(req('reset-password', body))).status).toBe(429);
  });
});
