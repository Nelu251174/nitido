import {NextRequest, NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {adminDashboard} from '@/lib/adminDashboard';

const response = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: {'Cache-Control': 'private, no-store'},
});

export async function GET(): Promise<NextResponse>;
export async function GET(req: NextRequest): Promise<NextResponse>;
export async function GET(req?: NextRequest) {
  const identity = await getAdminIdentity();
  if (!identity) return response({error: 'Neautorizat'}, 401);
  if (!hasAdminPermission(identity.role, 'operations')) return response({error: 'Acces operațional necesar.'}, 403);
  const attention = req?.nextUrl.searchParams.get('attention');
  if (attention && attention !== 'all') return response({error: 'Filtru de atenție invalid.'}, 400);
  try {
    return response(attention === 'all' ? adminDashboard(db, identity.role, new Date(), true) : adminDashboard(db, identity.role));
  } catch {
    return response({error: 'Situația nu a putut fi actualizată. Încearcă din nou.'}, 500);
  }
}
