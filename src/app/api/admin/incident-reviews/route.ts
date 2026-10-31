import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {WorkspaceError} from '@/lib/workspace';
import {incidentReviews,reviewIncident} from '@/lib/incidentReview';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId('incidents'))return response({error:'Neautorizat'},401);
 try{
 const offset=Number(req.nextUrl.searchParams.get('offset')??0);
 if(!Number.isSafeInteger(offset)||offset<0)throw new WorkspaceError('Pagină invalidă.');
 const jobId=req.nextUrl.searchParams.get('jobId'),caseId=req.nextUrl.searchParams.get('caseId');
 for(const value of [jobId,caseId])if(value!==null&&!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw new WorkspaceError('Identificator invalid.');
 const filters:string[]=[],args:string[]=[];
 if(jobId){filters.push('job_id=?');args.push(jobId);}
 if(caseId){filters.push('id=?');args.push(caseId);}
 const where=filters.length?' WHERE '+filters.join(' AND '):'';
 const cases=db.prepare(`SELECT id,job_id,category,description,photo_id,status,updated_at FROM visit_cases${where} ORDER BY updated_at DESC,id LIMIT 51 OFFSET ?`).all(...args,offset) as {id:string}[];
 return response({cases:cases.slice(0,50).map(c=>({...c,reviews:incidentReviews(db,c.id),events:db.prepare('SELECT action,note,created_at FROM visit_case_events WHERE case_id=? ORDER BY created_at,id').all(c.id)})),hasMore:cases.length>50});
 }catch(e){return response({error:e instanceof WorkspaceError?e.message:'Dosarele nu pot fi încărcate.'},e instanceof WorkspaceError?e.status:500);}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId('operations');if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 try{
 const raw=await req.text();if(Buffer.byteLength(raw)>12000)return response({error:'Cerere prea mare'},413);
 const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new WorkspaceError('Date invalide.');
 const review=db.transaction(()=>{const r=reviewIncident(db,input,actor);auditAdminAction('incident.reviewed',r.caseId,{actorId:actor,reviewId:r.id,outcome:r.outcome});return r;}).immediate();
 return response({review});
 }catch(e){return response({error:e instanceof WorkspaceError?e.message:e instanceof SyntaxError?'Date invalide.':'Verificarea nu a fost salvată. Reîncarcă dosarul.'},e instanceof WorkspaceError?e.status:e instanceof SyntaxError?400:500);}
}
