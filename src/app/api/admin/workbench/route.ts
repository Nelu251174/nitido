import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminIdentity } from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {adminWorkbench, AdminQueryError} from '@/lib/adminWorkbench';
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(req: NextRequest) {
    const identity = await getAdminIdentity();
    if (!identity)
        return response({ error: 'Neautorizat' }, 401);
    if (!hasAdminPermission(identity.role, 'session')) return response({error: 'Acces interzis.'}, 403);
    try {
        return response(adminWorkbench(db, identity.role, req.nextUrl.searchParams));
    } catch (error) {
        if (error instanceof AdminQueryError) return response({error: error.message}, 400);
        return response({error: 'Lista lucrărilor nu a putut fi încărcată.'}, 500);
    }
}
