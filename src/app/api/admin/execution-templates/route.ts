import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {ExecutionTemplateError,executionTemplates,saveExecutionTemplate} from '@/lib/executionTemplates';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){if(!await getAdminActorId())return response({error:'Neautorizat'},401);return response({templates:executionTemplates(db)});}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId();if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 try{const raw=await req.text();if(Buffer.byteLength(raw)>60000)return response({error:'Cerere prea mare'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new ExecutionTemplateError('Date invalide.');
 const result=db.transaction(()=>{const saved=saveExecutionTemplate(db,b,actor);auditAdminAction('execution.template.published',saved.scope,{actorId:actor,revision:saved.revision});return saved;}).immediate();return response({result,templates:executionTemplates(db)});
 }catch(e){return response({error:e instanceof ExecutionTemplateError?e.message:e instanceof SyntaxError?'Date invalide.':'Lista nu a putut fi salvată.'},e instanceof ExecutionTemplateError?e.status:e instanceof SyntaxError?400:500);}
}
