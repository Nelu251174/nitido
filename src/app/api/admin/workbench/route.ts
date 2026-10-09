import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminIdentity } from '@/lib/adminAuth';
import { hasAdminPermission } from '@/lib/adminRolesShared';
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(req: NextRequest) {
    const identity = await getAdminIdentity();
    if (!identity)
        return response({ error: 'Neautorizat' }, 401);
    const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0)
        return response({ error: 'Pagină invalidă' }, 400);
    const financial = hasAdminPermission(identity.role, 'finance');
    return db.transaction(() => {
        const rows = db.prepare('SELECT id,city,status,scheduled_at,accepted_firm_id FROM jobs ORDER BY created_at DESC,id LIMIT 51 OFFSET ?').all(offset) as {
            id: string;
        }[];
        const jobs = rows.slice(0, 50).map(j => ({ ...j, ...(financial ? { payments: db.prepare('SELECT p.id,p.status,p.amount_gross,p.refund_status,p.stripe_payment_intent_id,r.stripe_refund_id FROM payments p LEFT JOIN payment_refunds r ON r.payment_id=p.id WHERE p.job_id=?').all(j.id) } : {}) }));
        return response({ jobs, hasMore: rows.length > 50, financial });
    })();
}
