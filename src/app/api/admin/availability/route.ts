import {NextRequest,NextResponse} from 'next/server';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {db} from '@/lib/db';
import {approveOpening,AvailabilityError} from '@/lib/weeklyAvailability';
export async function POST(req:NextRequest){const a=await getAdminIdentity();if(!a||!hasAdminPermission(a.role,'manage'))return NextResponse.json({error:'Acces interzis'},{status:403});if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:'Origine invalidă'},{status:403});const b=await req.json().catch(()=>null);try{if(b?.action!=='approve')throw new AvailabilityError('Acțiune invalidă',400);return NextResponse.json({ok:true,pilotCity:approveOpening(db,String(b.id),a.id,b.confirmed)},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return NextResponse.json({error:e instanceof AvailabilityError?e.message:'Aprobarea nu a fost confirmată.'},{status:e instanceof AvailabilityError?e.status:503});}}
