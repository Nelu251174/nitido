import {NextRequest,NextResponse} from 'next/server';
import Stripe from 'stripe';
import {db} from '@/lib/db';
import {isAdmin} from '@/lib/adminAuth';
import {consumeRateLimit} from '@/lib/security';
import {reconcilePaymentCancellation} from '@/lib/paymentCancellation';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
function trusted(req:NextRequest){
 const origin=req.headers.get('origin');if(!origin)return false;
 if(origin===req.nextUrl.origin)return true;
 try{const site=new URL(process.env.NEXT_PUBLIC_SITE_URL??'');return site.protocol==='https:'&&!site.username&&!site.password&&origin===site.origin;}catch{return false;}
}
/** Retry an existing cancellation for a terminal job; never initiate a new release decision. */
export async function POST(req:NextRequest){
 if(!(await isAdmin('finance')))return reply({error:'Neautorizat'},401);
 if(!trusted(req))return reply({error:'Origine nepermisă'},403);
 if(!consumeRateLimit('admin-payment-cancellation',6,60000))return reply({error:'Prea multe încercări. Reîncearcă într-un minut.'},429);
 const body=await req.json().catch(()=>null);
 if(!body||typeof body.jobId!=='string'||!/^[a-zA-Z0-9_-]{1,150}$/.test(body.jobId))return reply({error:'Referință invalidă'},400);
 const key=process.env.STRIPE_SECRET_KEY??'';
 if(!/^(sk|rk)_test_/.test(key))return reply({error:'Recuperarea este disponibilă numai în Stripe sandbox.'},503);
 if(!db.prepare("SELECT 1 FROM payment_cancellation_requests c JOIN jobs j ON j.id=c.job_id WHERE c.job_id=? AND c.status!='processed' AND j.status IN ('cancelled','no_show')").get(body.jobId))return reply({error:'Nu există o anulare restantă pentru această lucrare închisă.'},409);
 try{
   await reconcilePaymentCancellation(db,body.jobId,new Stripe(key,{timeout:10000,maxNetworkRetries:1}),{sandboxOnly:true});
   const result=db.prepare('SELECT status FROM payment_cancellation_requests WHERE job_id=?').get(body.jobId) as {status:string};
   return reply({status:result.status});
 }catch{return reply({error:'Eliberarea rezervării nu a putut fi confirmată. Cererea rămâne disponibilă pentru reconciliere.'},409);}
}
