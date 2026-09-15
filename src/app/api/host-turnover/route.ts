import {requirePropertyModule,OrganizationError} from '@/lib/organizations';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {hostPlan,saveHostSettings,saveHostStay} from '@/lib/hostTurnover';
import {requireText,WorkspaceError} from '@/lib/workspace';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară.'},401);if(user.role!=='client')return response({error:'Acces interzis.'},403);
 try{return response(hostPlan(db,user.id,requireText(req.nextUrl.searchParams.get('propertyId'),'Proprietate',100)));}catch(e){if(e instanceof WorkspaceError||e instanceof OrganizationError)return response({error:e.message},e.status);console.error('[host] read_failed');return response({error:'Calendarul nu poate fi încărcat.'},500);}
}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară.'},401);if(user.role!=='client'||!hasTrustedMutationOrigin(req))return response({error:'Acces interzis.'},403);
 if(!consumeRateLimit(`host:${user.id}`,40,60000))return response({error:'Prea multe cereri. Reîncearcă într-un minut.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>12000)return response({error:'Cerere prea mare.'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new WorkspaceError('Cerere invalidă.');
  const propertyId=requireText(b.propertyId,'Proprietate',100);
  return db.transaction(()=>{
  hostPlan(db,user.id,propertyId);requirePropertyModule(db,propertyId,'host');
  if(b.action==='settings')saveHostSettings(db,user.id,propertyId,b);
  else if(b.action==='stay')saveHostStay(db,user.id,propertyId,b);
  else throw new WorkspaceError('Acțiune invalidă.');
  return response({ok:true});
  }).immediate();
 }catch(e){if(e instanceof WorkspaceError||e instanceof OrganizationError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă.'},400);console.error('[host] mutation_failed');return response({error:'Modificarea nu a putut fi salvată.'},500);}
}
