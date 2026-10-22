import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {WorkspaceError} from '@/lib/workspace';
import {AssessmentError} from '@/lib/assessments';
import {CustomerRestrictionError} from '@/lib/customerRestrictions';
import {readExtraWork,changeExtraWork} from '@/lib/extraWork';
export const runtime='nodejs';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const failure=(e:unknown)=>reply({error:e instanceof WorkspaceError||e instanceof AssessmentError||e instanceof CustomerRestrictionError?e.message:'Operația nu a fost confirmată. Reîncearcă.'},e instanceof WorkspaceError||e instanceof AssessmentError||e instanceof CustomerRestrictionError?e.status:e instanceof SyntaxError?400:503);
type Context={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Context){const u=await getCurrentUser(req);if(!u)return reply({error:'Autentificare necesară.'},401);try{return reply(readExtraWork(db,(await params).id,u));}catch(e){return failure(e);}}
export async function POST(req:NextRequest,{params}:Context){const u=await getCurrentUser(req);if(!u)return reply({error:'Autentificare necesară.'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă.'},403);if(!consumeRateLimit('extra-work:'+u.id,30,60000))return reply({error:'Prea multe cereri.'},429);try{const raw=await req.text();if(Buffer.byteLength(raw)>6000)return reply({error:'Cerere prea mare.'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Cerere invalidă.'},400);return reply(changeExtraWork(db,(await params).id,u,b));}catch(e){return failure(e);}}
