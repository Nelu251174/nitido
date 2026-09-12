import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {AssessmentError,createAssessment,listAssessments,updateAssessment} from '@/lib/assessments';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){const u=await getCurrentUser(req);if(!u||u.role!=='client')return response({error:'Autentificare ca client necesară'},401);return response({requests:listAssessments(db,u.id)});}
export async function POST(req:NextRequest){const u=await getCurrentUser(req);if(!u||u.role!=='client')return response({error:'Autentificare ca client necesară'},401);if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);if(!consumeRateLimit(`assessments:${u.id}`,20,60000))return response({error:'Prea multe cereri. Reîncearcă într-un minut.'},429);try{const raw=await req.text();if(Buffer.byteLength(raw)>20000)return response({error:'Cerere prea mare'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object')return response({error:'Cerere invalidă'},400);if(b.action==='create'){const id=createAssessment(db,u.id,b.requestKey,b.input);return response({id})}updateAssessment(db,{clientId:u.id},b.id,b.version,b.action,b.body);return response({ok:true})}catch(e){if(e instanceof AssessmentError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);throw e}}
