import { NextResponse, type NextRequest } from 'next/server';
import { adminPasswordRecoveryEnabled } from './adminPasswordCredentials';
import { hasTrustedAdminOrigin } from './adminMfa';
import { consumeRateLimit, requestIp } from './security';

export const adminRecoveryReply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy':'no-referrer' } });
export function adminRecoveryGuard(req: NextRequest, action: string) {
  if (!adminPasswordRecoveryEnabled()) return adminRecoveryReply({ error: 'Recuperare indisponibilă.' }, 404);
  if (!hasTrustedAdminOrigin(req) || req.headers.has('authorization')) return adminRecoveryReply({ error: 'Origine invalidă.' }, 403);
  if (!consumeRateLimit(`admin-recovery:${action}:${requestIp(req)}`, 5, 15 * 60000)) return adminRecoveryReply({ error: 'Prea multe cereri. Reîncearcă peste 15 minute.' }, 429);
  return null;
}
export async function readAdminRecoveryBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  if (!req.headers.get('content-type')?.startsWith('application/json')) return null;
  const reader = req.body?.getReader(); if (!reader) return null;
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const result = await reader.read(); if (result.done) break;
    size += result.value.length;
    if (size > 4096) { await reader.cancel(); return null; }
    chunks.push(result.value);
  }
  try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); return body && typeof body === 'object' && !Array.isArray(body) ? body : null; }
  catch { return null; }
}
