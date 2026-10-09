import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,isAdmin} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {WorkspaceError} from '@/lib/workspace';
import {acknowledgeIncidentSla,incidentSlaInbox} from '@/lib/incidentSla';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId('operations'))return reply({error:'Neautorizat'},401);
 try{return reply(incidentSlaInbox(db,req.nextUrl.searchParams.get('caseId')??undefined));}catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId('operations');if(!actor)return reply({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>5000)return reply({error:'Cerere prea mare'},413);
  const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['alertId','note','caseRevision'].includes(k)))throw new WorkspaceError('Date invalide.');
  const canManage=await isAdmin('manage');
  return reply(db.transaction(()=>acknowledgeIncidentSla(db,input,actor,Date.now(),canManage)).immediate());
 }catch(e){return failure(e);}
}
function failure(e:unknown){return reply({error:e instanceof WorkspaceError?e.message:e instanceof SyntaxError?'Date invalide.':'Operațiunea nu a fost confirmată. Reîncarcă alertele.'},e instanceof WorkspaceError?e.status:e instanceof SyntaxError?400:500);}
