import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminIdentity, auditAdminAction } from '@/lib/adminAuth';
import { hasAdminPermission } from '@/lib/adminRolesShared';
import { hasTrustedAdminOrigin } from '@/lib/adminMfa';
import { incidentResolutions, resolveIncident } from '@/lib/incidentResolution';
import { WorkspaceError } from '@/lib/workspace';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(req: NextRequest) { const actor = await getAdminIdentity(); if (!actor || !hasAdminPermission(actor.role, 'incidents'))
    return reply({ error: 'Acces interzis' }, 403); const id = req.nextUrl.searchParams.get('caseId') ?? ''; if (!id || id.length > 100)
    return reply({ error: 'Dosar invalid' }, 400); return reply({ history: incidentResolutions(db, id) }); }
export async function POST(req: NextRequest) { const actor = await getAdminIdentity(); if (!actor)
    return reply({ error: 'Neautorizat' }, 401); if (!hasTrustedAdminOrigin(req))
    return reply({ error: 'Origine invalidă' }, 403); try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 14000)
        return reply({ error: 'Cerere prea mare' }, 413);
    const b = JSON.parse(raw);
    if (!b || typeof b !== 'object' || Array.isArray(b))
        throw new WorkspaceError('Date invalide.');
    const result = db.transaction(() => { const result = resolveIncident(db, b, actor); auditAdminAction('incident.resolution', result.caseId, { actorId: actor.id, ...result }); return result; }).immediate();
    return reply({ result });
}
catch (e) {
    return reply({ error: e instanceof WorkspaceError ? e.message : e instanceof SyntaxError ? 'Date invalide.' : 'Rezoluția nu a fost confirmată.' }, e instanceof WorkspaceError ? e.status : e instanceof SyntaxError ? 400 : 500);
} }
