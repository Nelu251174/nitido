import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminActorId, auditAdminAction } from '@/lib/adminAuth';
import { hasTrustedMutationOrigin } from '@/lib/security';
import { ProviderScoreError, saveScorePolicy } from '@/lib/providerScore';
import { providerScoreReport } from '@/lib/providerScoreReport';
import { MarginError } from '@/lib/operationalMargin';
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  if (!await getAdminActorId('reports')) return response({ error: 'Neautorizat' }, 401);
  try { return response(providerScoreReport(db)); }
  catch (error) { return response({ error: error instanceof MarginError ? error.message : 'Scorul nu poate fi calculat.' }, error instanceof MarginError ? error.status : 500); }
}
export async function POST(req: NextRequest) {
  const actor = await getAdminActorId('manage');
  if (!actor) return response({ error: 'Neautorizat' }, 401);
  if (!hasTrustedMutationOrigin(req)) return response({ error: 'Origine invalidă' }, 403);
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 10000) return response({ error: 'Cerere prea mare' }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProviderScoreError('Date invalide.');
    const saved = db.transaction(() => {
      const result = saveScorePolicy(db, body, actor);
      auditAdminAction('provider.score.observation.policy', String(result.revision), { actorId: actor, revision: result.revision, mode: 'observation' });
      return result;
    }).immediate();
    return response({ result: saved });
  } catch (error) {
    return response({ error: error instanceof ProviderScoreError ? error.message : error instanceof SyntaxError ? 'Date invalide.' : 'Regula nu a putut fi salvată.' }, error instanceof ProviderScoreError ? error.status : error instanceof SyntaxError ? 400 : 500);
  }
}
