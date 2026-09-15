import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {requireText,WorkspaceError} from '@/lib/workspace';
import {manualCalendarSources,connectionStatus,controlConnection,saveConnection,syncConnection} from '@/lib/icalSync';
export const runtime='nodejs';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară.'},401);if(user.role!=='client')return response({error:'Acces interzis.'},403);
 try{const propertyId=requireText(req.nextUrl.searchParams.get('propertyId'),'Proprietate',100);return response({connection:connectionStatus(db,user.id,propertyId),sources:manualCalendarSources(db,user.id,propertyId)});}catch(e){return failure(e);}
}
function failure(e:unknown){if(e instanceof WorkspaceError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă.'},400);return response({error:'Calendarul nu poate fi actualizat momentan.'},500);}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară.'},401);if(user.role!=='client'||!hasTrustedMutationOrigin(req))return response({error:'Acces interzis.'},403);
 if(!consumeRateLimit(`ical:${user.id}`,12,60000))return response({error:'Prea multe cereri. Revino într-un minut.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>12000)return response({error:'Cerere prea mare.'},413);
  const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new WorkspaceError('Cerere invalidă.');
  const propertyId=requireText(b.propertyId,'Proprietate',100);
  if(b.action==='connect'){
   // Persist immediately. The worker performs the initial download within one minute.
   saveConnection(db,user.id,propertyId,b);
  }else if(b.action==='sync'){
   const c=connectionStatus(db,user.id,propertyId) as {id:string}|null;if(!c)throw new WorkspaceError('Calendar neconectat.',404);
   await syncConnection(db,c.id,user.id);
  }else controlConnection(db,user.id,propertyId,b);
  return response({ok:true,connection:connectionStatus(db,user.id,propertyId)});
 }catch(e){return failure(e);}
}
