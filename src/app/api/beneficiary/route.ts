import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {acceptBeneficiary,beneficiaryVisits,FamilyError} from '@/lib/familyBooking';
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export async function GET(req:NextRequest){const u=await getCurrentUser(req);if(!u||u.role!=='client')return reply({error:'Autentificare client necesară'},401);return reply({visits:beneficiaryVisits(db,u.id)});}
export async function POST(req:NextRequest){const u=await getCurrentUser(req);if(!u||u.role!=='client')return reply({error:'Autentificare client necesară'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);if(!consumeRateLimit('accept-beneficiary:'+u.id,15,600000))return reply({error:'Prea multe încercări'},429);const b=await req.json().catch(()=>null);try{return reply({ok:true,jobId:acceptBeneficiary(db,u.id,b?.token)});}catch(e){return reply({error:e instanceof Error?e.message:'Invitația nu a fost acceptată'},e instanceof FamilyError?e.status:500);}}
