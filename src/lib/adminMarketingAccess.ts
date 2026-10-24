import { NextResponse, type NextRequest } from 'next/server';
import { getAdminActorId } from '@/lib/adminAuth';
import { consumeRateLimit } from '@/lib/security';
import { hasTrustedAdminOrigin } from '@/lib/adminMfa';
import { marketingEnabled, MarketingError } from './adminMarketing';

export async function marketingAccess(req: NextRequest, mutation = false) {
  if (!marketingEnabled()) return { error: NextResponse.json({ error: 'Modul indisponibil.' }, { status: 404 }) };
  const actor = await getAdminActorId('super_admin');
  if (!actor) return { error: NextResponse.json({ error: 'Acces rezervat administratorului.' }, { status: 401 }) };
  if (mutation && !hasTrustedAdminOrigin(req)) return { error: NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 }) };
  if (mutation && !consumeRateLimit(`marketing:${actor}`, 30, 60000)) return { error: NextResponse.json({ error: 'Prea multe cereri. Reîncearcă într-un minut.' }, { status: 429 }) };
  return { actor };
}

export async function marketingBody(req: NextRequest): Promise<Record<string, unknown>> {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new MarketingError('Este necesar un corp JSON.', 415);
  const reader = req.body?.getReader();
  if (!reader) throw new MarketingError('Cerere invalidă.');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 500000) { await reader.cancel(); throw new MarketingError('Cererea depășește 500 KB.', 413); }
    chunks.push(value);
  }
  let data: unknown;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new MarketingError('JSON invalid.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new MarketingError('Cerere invalidă.');
  return data as Record<string, unknown>;
}

export function marketingFailure(error: unknown): NextResponse {
  if (error instanceof MarketingError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Contact data and provider responses must never be reflected in diagnostics.
  console.error('[marketing] operation_failed');
  return NextResponse.json({ error: 'Operațiunea nu a reușit. Reîncearcă.' }, { status: 500 });
}
