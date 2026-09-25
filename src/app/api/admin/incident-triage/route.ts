import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {WorkspaceError} from '@/lib/workspace';
import {currentIncidentPolicy,incidentDeadlines,saveIncidentPolicy,saveIncidentTriage} from '@/lib/incidentTriage';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId())return response({error:'Neautorizat'},401);
 try{const id=req.nextUrl.searchParams.get('caseId');return response({policy:currentIncidentPolicy(db)??null,...(id?{case:incidentDeadlines(db,id)}:{})});}catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId();if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 try{const raw=await req.text();if(Buffer.byteLength(raw)>14000)return response({error:'Cerere prea mare'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new WorkspaceError('Date invalide.');
 const result=db.transaction(()=>{let data;if(b.action==='policy')data=saveIncidentPolicy(db,b,actor);else if(b.action==='triage')data=saveIncidentTriage(db,b,actor);else throw new WorkspaceError('Acțiune invalidă.');auditAdminAction('incident.'+b.action,b.caseId??null,{actorId:actor,revision:data.revision});return data;}).immediate();
 return response({result});
 }catch(e){return failure(e);}
}
function failure(e:unknown){return response({error:e instanceof WorkspaceError?e.message:e instanceof SyntaxError?'Date invalide.':'Operațiunea nu a fost confirmată. Reîncarcă.'},e instanceof WorkspaceError?e.status:e instanceof SyntaxError?400:500);}
