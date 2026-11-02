import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {InternationalTariffError} from '@/lib/internationalTariffs';
import {issueInternationalBookingQuote} from '@/lib/internationalBooking';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user||user.role!=='client')return reply({error:'Autentifică-te ca client.'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);
 if(!consumeRateLimit('international-quote:'+user.id,20,60000))return reply({error:'Prea multe cereri.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>5000)return reply({error:'Cerere prea mare'},413);
  const body=JSON.parse(raw);return reply({quote:issueInternationalBookingQuote(db,user.id,body),financialOperations:0});
 }catch(error){
  if(error instanceof InternationalTariffError)return reply({error:error.message},error.status);
  if(error instanceof SyntaxError)return reply({error:'Date invalide.'},400);
  return reply({error:'Oferta nu a putut fi verificată. Nicio plată nu a fost inițiată.'},500);
 }
}
