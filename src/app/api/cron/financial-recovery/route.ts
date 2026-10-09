import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import Stripe from 'stripe';
import {db} from '@/lib/db';
import {runFinancialRecovery,sandboxRecoveryConfigured} from '@/lib/financialRecovery';

export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 const secret=process.env.NITIDO_FINANCIAL_RECOVERY_SECRET??'';
 if(secret.trim().length<32||!sandboxRecoveryConfigured())return reply({error:'Recuperarea periodică sandbox nu este configurată.'},503);
 const supplied=Buffer.from(req.headers.get('x-recovery-secret')??''),expected=Buffer.from(secret);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return reply({error:'Neautorizat'},401);
 try{
   const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!,{timeout:8000,maxNetworkRetries:0});
   return reply(await runFinancialRecovery(db,stripe));
 }catch{return reply({error:'Rularea nu a putut fi confirmată. Verifică istoricul recuperării.'},503);}
}
