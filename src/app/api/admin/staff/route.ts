import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminIdentity, auditAdminAction } from '@/lib/adminAuth';
import { AdminStaffError, saveAdminStaff, staffCredentials } from '@/lib/adminStaff';
import { hasTrustedAdminOrigin } from '@/lib/adminMfa';
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() { const actor = await getAdminIdentity(); if (actor?.role !== 'super_admin')
    return response({ error: 'Acces interzis' }, 403); const credentials = staffCredentials(); return response({ accounts: (db.prepare('SELECT id,email,role,active,revision FROM admin_staff ORDER BY email').all() as {
        email: string;
    }[]).map(a => ({ ...a, credentialsConfigured: credentials.has(a.email) })), history: db.prepare('SELECT account_id,revision,email,role,active,reason,actor_id,created_at FROM admin_staff_history ORDER BY created_at DESC,id DESC LIMIT 100').all() }); }
export async function POST(req: NextRequest) {
    const actor = await getAdminIdentity();
    if (actor?.role !== 'super_admin')
        return response({ error: 'Acces interzis' }, 403);
    if (!hasTrustedAdminOrigin(req))
        return response({ error: 'Origine invalidă' }, 403);
    try {
        const raw = await req.text();
        if (Buffer.byteLength(raw) > 12000)
            return response({ error: 'Cerere prea mare' }, 413);
        const b = JSON.parse(raw);
        if (!b || typeof b !== 'object' || Array.isArray(b))
            throw new AdminStaffError('Date invalide.');
        const result = db.transaction(() => { const account = saveAdminStaff(db, b, actor); auditAdminAction('admin.staff.changed', account.id, { actorId: actor.id, revision: account.revision, role: account.role, active: account.active }); return account; }).immediate();
        return response({ account: result });
    }
    catch (e) {
        return response({ error: e instanceof AdminStaffError ? e.message : e instanceof SyntaxError ? 'Date invalide.' : 'Modificarea nu a fost confirmată.' }, e instanceof AdminStaffError ? e.status : e instanceof SyntaxError ? 400 : 500);
    }
}
