import {NextRequest,NextResponse} from 'next/server';
import Stripe from 'stripe';
import {db} from '@/lib/db';
import {isAdmin} from '@/lib/adminAuth';
import {consumeRateLimit} from '@/lib/security';
import {reconcileSandboxPayout} from '@/lib/payoutReconciliation';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
function validIds(body:unknown):body is {accountId:string;payoutId:string}{return !!body&&typeof body==='object'&&'accountId' in body&&typeof body.accountId==='string'&&/^acct_[a-zA-Z0-9]{1,100}$/.test(body.accountId)&&'payoutId' in body&&typeof body.payoutId==='string'&&/^po_[a-zA-Z0-9]{1,100}$/.test(body.payoutId);}
export async function GET(req:NextRequest){
 if(!(await isAdmin('finance')))return reply({error:'Neautorizat'},401);
 const ids={accountId:req.nextUrl.searchParams.get('accountId'),payoutId:req.nextUrl.searchParams.get('payoutId')};
 if(!validIds(ids))return reply({error:'Referințe invalide'},400);
 const row=db.prepare('SELECT report_json FROM payout_reconciliation_runs WHERE account_id=? AND payout_id=? ORDER BY rowid DESC LIMIT 1').get(ids.accountId,ids.payoutId) as {report_json:string}|undefined;
 return reply({report:row?JSON.parse(row.report_json):null});
}
function trusted(req:NextRequest){
 const origin=req.headers.get('origin');
 if(!origin)return false;
 if(origin===req.nextUrl.origin)return true;
 try{const site=new URL(process.env.NEXT_PUBLIC_SITE_URL??'');return site.protocol==='https:'&&!site.username&&!site.password&&origin===site.origin;}catch{return false;}
}
export async function POST(req:NextRequest){
 if(!(await isAdmin('finance')))return reply({error:'Neautorizat'},401);
 if(!trusted(req))return reply({error:'Origine nepermisă'},403);
 if(!consumeRateLimit('admin-payout-reconciliation',6,60000))return reply({error:'Prea multe verificări. Reîncearcă într-un minut.'},429);
 const body=await req.json().catch(()=>null);
 if(!validIds(body))return reply({error:'Referințe invalide'},400);
 const key=process.env.STRIPE_SECRET_KEY??'';
 if(!/^(sk|rk)_test_/.test(key))return reply({error:'Reconcilierea este disponibilă numai în Stripe sandbox.'},503);
 try{
   const stripe=new Stripe(key,{timeout:10000,maxNetworkRetries:1});
   const report=await reconcileSandboxPayout(db,stripe,body.accountId,body.payoutId);
   return reply({report});
 }catch{return reply({error:'Reconcilierea nu a putut fi confirmată. Verifică accesul Stripe și referințele, apoi reîncearcă.'},409);}
}
