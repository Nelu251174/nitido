import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasTrustedAdminOrigin} from '@/lib/adminMfa';
import {AccountRemovalError,removeAdminAccount} from '@/lib/adminAccountRemoval';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 const actor=await getAdminIdentity();if(!actor)return reply({error:'Neautorizat'},401);
 if(actor.role!=='super_admin')return reply({error:'Ștergerea conturilor este permisă numai pentru Super Admin.'},403);
 if(!hasTrustedAdminOrigin(req))return reply({error:'Origine invalidă'},403);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>4096)return reply({error:'Cerere prea mare'},413);
  return reply(removeAdminAccount(db,JSON.parse(raw),actor.id));
 }catch(error){
  if(error instanceof AccountRemovalError)return reply({error:error.message},error.status);
  if(error instanceof SyntaxError)return reply({error:'Date invalide.'},400);
  return reply({error:'Ștergerea nu a fost confirmată. Reîncarcă lista înainte de reîncercare.'},500);
 }
}
