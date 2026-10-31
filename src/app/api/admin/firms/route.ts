import {NextRequest, NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {adminFirms, AdminQueryError} from '@/lib/adminWorkbench';

const response = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: {'Cache-Control': 'private, no-store'},
});

export async function GET(req: NextRequest) {
  const identity = await getAdminIdentity();
  if (!identity) return response({error: 'Neautorizat'}, 401);
  if (!hasAdminPermission(identity.role, 'manage')) return response({error: 'Drept de gestionare necesar.'}, 403);
  try {
    return response(adminFirms(db, req.nextUrl.searchParams));
  } catch (error) {
    if (error instanceof AdminQueryError) return response({error: error.message}, 400);
    return response({error: 'Lista firmelor nu a putut fi încărcată.'}, 500);
  }
}
