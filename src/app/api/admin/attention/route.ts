import {NextResponse} from 'next/server';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {db} from '@/lib/db';
import {ownerAttention} from '@/lib/ownerAttention';
export async function GET(){const a=await getAdminIdentity();if(!a||!hasAdminPermission(a.role,'operations'))return NextResponse.json({error:'Acces interzis'},{status:403});return NextResponse.json(ownerAttention(db),{headers:{'Cache-Control':'private, no-store'}});}
