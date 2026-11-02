import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {emailDiagnostics} from '@/lib/emailDeliveryDiagnostics';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const identity=await getAdminIdentity();
 if(!identity)return reply({error:'UNAUTHORIZED'},401);
 if(!hasAdminPermission(identity.role,'super_admin'))return reply({error:'FORBIDDEN'},403);
 const raw=req.nextUrl.searchParams.get('limit')??'50';
 if(!/^\d{1,3}$/.test(raw)||Number(raw)<1||Number(raw)>100)return reply({error:'INVALID_LIMIT'},400);
 try{return reply(emailDiagnostics(db,Number(raw)))}catch{return reply({error:'EMAIL_DIAGNOSTICS_UNAVAILABLE'},503)}
}
