import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {readVisitCare,changeVisitCare} from '@/lib/visitCare';
import {WorkspaceError} from '@/lib/workspace';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){const user=await getCurrentUser(req);if(!user)return reply({error:'Autentificare necesară'},401);try{return reply(readVisitCare(db,(await params).id,user))}catch(e){return reply({error:e instanceof WorkspaceError?e.message:'Date indisponibile'},e instanceof WorkspaceError?e.status:503)}}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){const user=await getCurrentUser(req);if(!user)return reply({error:'Autentificare necesară'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);if(!consumeRateLimit(`care:${user.id}`,30,60000))return reply({error:'Prea multe cereri'},429);try{const raw=await req.text();if(Buffer.byteLength(raw)>6000)return reply({error:'Cerere prea mare'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Cerere invalidă'},400);return reply(changeVisitCare(db,(await params).id,user,b))}catch(e){return reply({error:e instanceof WorkspaceError?e.message:'Operația nu a fost confirmată. Reîncarcă dosarul.'},e instanceof WorkspaceError?e.status:e instanceof SyntaxError?400:503)}}
