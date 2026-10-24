import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { applyAdminPasswordReset, validAdminPasswordReset, consumeAdminRecoveryLimit } from '@/lib/adminPasswordReset';
import { adminRecoveryGuard, adminRecoveryReply, readAdminRecoveryBody } from '@/lib/adminRecoveryHttp';

const invalid = () => adminRecoveryReply({ error: 'Linkul sau codul 2FA nu este valid. Verifică datele ori cere un link nou.' }, 400);
export async function POST(req: NextRequest) {
  const denied = adminRecoveryGuard(req, 'confirm'); if (denied) return denied;
  const body = await readAdminRecoveryBody(req);
  if (!body || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token) || typeof body.password !== 'string' || typeof body.code !== 'string' || !['totp', 'recovery'].includes(String(body.method))) return invalid();
  if (body.password.length < 12 || Buffer.byteLength(body.password) > 72 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) return adminRecoveryReply({ error: 'Parola trebuie să aibă minimum 12 caractere, litere și cifre și maximum 72 de octeți.' }, 400);
  if (body.method === 'totp' ? !/^\d{6}$/.test(body.code) : !/^[a-f0-9]{32}$/i.test(body.code)) return invalid();
  try {
    const token = validAdminPasswordReset(db, body.token); if (!token) return invalid();
    if (!consumeAdminRecoveryLimit(db, `confirm:${token.account_id}`, 5, 15 * 60000)) return adminRecoveryReply({ error: 'Prea multe încercări. Reîncearcă peste 15 minute.' }, 429);
    const passwordHash = await bcrypt.hash(body.password, 12);
    if (!applyAdminPasswordReset(db, body.token, passwordHash, body.code, body.method as 'totp' | 'recovery')) return invalid();
    return adminRecoveryReply({ ok: true });
  } catch { return adminRecoveryReply({ error: 'Parola nu a putut fi schimbată. Reîncearcă folosind același link și un cod 2FA nou.' }, 503); }
}
