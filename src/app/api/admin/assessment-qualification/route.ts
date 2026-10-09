import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminActorId, auditAdminAction } from '@/lib/adminAuth';
import { hasTrustedMutationOrigin } from '@/lib/security';
import { assessmentQualification, reportQualification, verifyAssessmentQualification, QualificationError } from '@/lib/assessmentQualification';
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const failure = (error: unknown) => response({ error: error instanceof QualificationError ? error.message : error instanceof SyntaxError ? 'Date invalide.' : 'Verificarea nu a fost confirmată. Actualizează înainte de a reîncerca.' }, error instanceof QualificationError ? error.status : error instanceof SyntaxError ? 400 : 503);
export async function GET(req: NextRequest) {
  if (!await getAdminActorId('operations')) return response({ error: 'Neautorizat' }, 401);
  try {
    const q = req.nextUrl.searchParams, id = q.get('id');
    if (id) return response(assessmentQualification(db, id, q.has('before') ? Number(q.get('before')) : undefined));
    return response(reportQualification(db, { from: q.get('from') ?? '', to: q.get('to') ?? '', city: q.get('city') ?? undefined, category: q.get('category') ?? undefined, client: q.get('client') ?? undefined }));
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  const actor = await getAdminActorId('operations');
  if (!actor) return response({ error: 'Neautorizat' }, 401);
  if (!hasTrustedMutationOrigin(req)) return response({ error: 'Origine invalidă' }, 403);
  try {
    const raw = await req.text(); if (Buffer.byteLength(raw) > 10000) return response({ error: 'Cerere prea mare' }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new QualificationError('Cerere invalidă.');
    const result = db.transaction(() => {
      const state = verifyAssessmentQualification(db, body, actor);
      auditAdminAction('assessment.qualification_checked', body.id, { actorId: actor, revision: state.revision, assessmentVersion: state.assessmentVersion, outcome: state.state, criteriaVersion: 1 });
      return state;
    }).immediate();
    return response(result);
  } catch (error) { return failure(error); }
}
