import {NextRequest,NextResponse} from 'next/server';
import Stripe from 'stripe';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {WorkspaceError} from '@/lib/workspace';
import {rescheduleAuthorization} from '@/lib/rescheduleAuthorization';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(req);
 if(!user||user.role!=='client')return reply({error:'Folosește contul clientului care a creat rezervarea.'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'Origine nepermisă.'},403);
 if(!consumeRateLimit(`reschedule-card:${user.id}`,20,60000))return reply({error:'Prea multe încercări. Reîncearcă peste un minut.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>2000)return reply({error:'Cerere prea mare.'},413);
  const body=JSON.parse(raw);
  if(!body||typeof body!=='object'||Array.isArray(body)||!['start','begin','verify'].includes(body.action)||typeof body.requestId!=='string'||body.requestId.length>100)return reply({error:'Acțiune invalidă.'},400);
  const key=process.env.STRIPE_SECRET_KEY;if(!key)return reply({error:'Confirmarea cardului nu este configurată.'},503);
  const stripe=new Stripe(key,{timeout:8000,maxNetworkRetries:0});
  return reply(await rescheduleAuthorization(db,stripe,user.id,(await params).id,body.requestId,body.action));
 }catch(error){return reply({error:error instanceof WorkspaceError?error.message:'Confirmarea nu a fost încheiată. Reîncarcă starea plății înainte să continui.'},error instanceof WorkspaceError?error.status:error instanceof SyntaxError?400:502)}
}
