import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasTrustedMutationOrigin, consumeRateLimit } from '@/lib/security';
import { recoverSelection } from '@/lib/selectionRecovery';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== 'client') return reply({ error: 'Autentificare necesară.' }, 401);
  if (!hasTrustedMutationOrigin(req)) return reply({ error: 'Origine invalidă.' }, 403);
  if (!consumeRateLimit(`selection-recovery:${user.id}`, 10, 60000)) return reply({ error: 'Prea multe încercări. Reîncearcă într-un minut.' }, 429);
  const { id } = await params;
  const result = recoverSelection(db, id, user.id);
  if (!result.ok) return reply({ error: 'Confirmarea necesită verificare. Reîncarcă lucrarea; dacă problema persistă, contactează suportul.' }, result.status);
  return reply({ ok: true });
}
