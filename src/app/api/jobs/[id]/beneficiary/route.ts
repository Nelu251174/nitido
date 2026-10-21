import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {ownedBeneficiary,inviteBeneficiary,revokeBeneficiary,FamilyError} from '@/lib/familyBooking';
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){const u=await getCurrentUser(req);if(!u||u.role!=='client')return reply({error:'Autentificare client necesară'},401);try{return reply({beneficiary:ownedBeneficiary(db,(await params).id,u.id)});}catch(e){return reply({error:e instanceof Error?e.message:'Beneficiar indisponibil'},e instanceof FamilyError?e.status:500);}}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const u=await getCurrentUser(req);if(!u||u.role!=='client')return reply({error:'Autentificare client necesară'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);if(!consumeRateLimit('beneficiary:'+u.id,20,3600000))return reply({error:'Prea multe solicitări. Reîncearcă mai târziu.'},429);
 const {id}=await params,b=await req.json().catch(()=>null);try{if(b?.action==='revoke'){revokeBeneficiary(db,id,u.id);return reply({ok:true});}if(b?.action!=='invite')return reply({error:'Acțiune invalidă'},400);return reply({ok:true,token:inviteBeneficiary(db,id,u.id)});}catch(e){return reply({error:e instanceof Error?e.message:'Invitația nu a fost salvată'},e instanceof FamilyError?e.status:500);}
}
