import { NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/adminAuth';
export async function GET() { const identity = await getAdminIdentity(); return NextResponse.json(identity ? { identity } : { error: 'Neautorizat' }, { status: identity ? 200 : 401, headers: { 'Cache-Control': 'private, no-store' } }); }
