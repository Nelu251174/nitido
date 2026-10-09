import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {rescheduleHistory,proposeReschedule,decideReschedule} from '@/lib/rescheduling';
import {WorkspaceError} from '@/lib/workspace';
import Stripe from 'stripe';
import {cleanupRescheduleAuthorization} from '@/lib/rescheduleAuthorization';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(req);if(!user)return reply({error:'Autentificare necesară'},401);
 try{return reply({requests:rescheduleHistory(db,(await params).id,user)})}catch(error){return reply({error:error instanceof WorkspaceError?error.message:'Date indisponibile'},error instanceof WorkspaceError?error.status:503)}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(req);if(!user)return reply({error:'Autentificare necesară'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);
 if(!consumeRateLimit(`reschedule:${user.id}`,20,60000))return reply({error:'Prea multe cereri'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>3000)return reply({error:'Cerere prea mare'},413);
  const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Cerere invalidă'},400);
  const {id}=await params;
  if(b.action==='propose')return reply(proposeReschedule(db,id,user,b));
  if(!['accept','reject','withdraw'].includes(b.action)||typeof b.requestId!=='string')return reply({error:'Acțiune invalidă'},400);
  const result=await decideReschedule(db,id,user,b.requestId,b.action);
  if(b.action!=='accept'&&process.env.STRIPE_SECRET_KEY){
   // The decision is already durable; a failed release remains queued for the scheduled backstop.
   await cleanupRescheduleAuthorization(db,new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:5000,maxNetworkRetries:0}),b.requestId).catch(()=>{});
  }
  return reply(result);
 }catch(error){return reply({error:error instanceof WorkspaceError?error.message:'Operația nu a fost confirmată. Reîncarcă rezervarea.'},error instanceof WorkspaceError?error.status:error instanceof SyntaxError?400:503)}
}
