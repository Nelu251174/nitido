import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {getStripeClient} from '@/lib/payments';
import {cardConfirmation,CardConfirmationError} from '@/lib/cardConfirmation';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(req);
 if(!user||user.role!=='client')return reply({error:'Autentifică-te în contul clientului.'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'Origine nepermisă.'},403);
 if(!consumeRateLimit(`card-confirm:${user.id}`,20,60000))return reply({error:'Prea multe încercări. Reîncearcă peste un minut.'},429);
 const body=await req.json().catch(()=>null);
 if(!body||!['start','verify'].includes(body.action))return reply({error:'Acțiune invalidă.'},400);
 try{const stripe=getStripeClient();if(!stripe)return reply({error:'Plățile nu sunt configurate momentan.'},503);const {id}=await params;return reply(await cardConfirmation(db,stripe,user.id,id,body.action));}
 catch(error){return reply({error:error instanceof CardConfirmationError?error.message:'Confirmarea nu a putut fi verificată. Reîncearcă.'},error instanceof CardConfirmationError?error.status:502);}
}
