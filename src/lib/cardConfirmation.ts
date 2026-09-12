import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';
import {createHash} from 'node:crypto';
import {calculatePaymentSplit} from './payments';
export class CardConfirmationError extends Error {constructor(message:string,public status=409){super(message)}}
const idOf=(value:string|{id:string}|null)=>typeof value==='string'?value:value?.id;

/** Only the booking owner can confirm an existing, server-priced manual authorization. */
export async function cardConfirmation(db:Database,stripe:Stripe,userId:string,jobId:string,action:'start'|'verify'){
 const job=db.prepare('SELECT j.*,u.stripe_customer_id FROM jobs j JOIN users u ON u.id=j.client_id WHERE j.id=? AND j.client_id=?').get(jobId,userId) as {status:string;price_gross:number;credit_applied:number;stripe_customer_id:string|null}|undefined;
 if(!job)throw new CardConfirmationError('Lucrarea nu a fost găsită.',404);
 if(job.status!=='waiting')throw new CardConfirmationError('Starea lucrării s-a schimbat. Revino la lucrare.');
 const attempt=db.prepare('SELECT * FROM payment_authorization_attempts WHERE job_id=?').get(jobId) as {request_json:string;provider_key_hash:string;stripe_payment_intent_id:string|null}|undefined;
 if(!attempt?.stripe_payment_intent_id)throw new CardConfirmationError('Plata necesită verificare înainte de confirmarea cardului.');
 if(attempt.provider_key_hash!==createHash('sha256').update(process.env.STRIPE_SECRET_KEY??'').digest('hex'))throw new CardConfirmationError('Plata necesită reconciliere.');
 const params=JSON.parse(attempt.request_json) as Stripe.PaymentIntentCreateParams;
 const split=calculatePaymentSplit(job.price_gross,job.credit_applied??0);
 if(params.amount!==split.clientAmount*100||params.currency!=='ron'||params.customer!==job.stripe_customer_id||typeof params.payment_method!=='string'||typeof params.metadata?.paymentId!=='string')throw new CardConfirmationError('Datele rezervării s-au schimbat. Plata necesită verificare.');
 const intent=await stripe.paymentIntents.retrieve(attempt.stripe_payment_intent_id);
 if(intent.id!==attempt.stripe_payment_intent_id||intent.amount!==params.amount||intent.currency!=='ron'||intent.capture_method!=='manual'||idOf(intent.customer)!==job.stripe_customer_id||intent.metadata.jobId!==jobId||intent.metadata.paymentId!==params.metadata.paymentId)throw new CardConfirmationError('Datele plății nu corespund rezervării.');
 const currentJob=db.prepare('SELECT j.status,j.price_gross,j.credit_applied,u.stripe_customer_id FROM jobs j JOIN users u ON u.id=j.client_id WHERE j.id=? AND j.client_id=?').get(jobId,userId) as typeof job|undefined;
 if(!currentJob||currentJob.status!=='waiting'||currentJob.price_gross!==job.price_gross||currentJob.credit_applied!==job.credit_applied||currentJob.stripe_customer_id!==job.stripe_customer_id)throw new CardConfirmationError('Rezervarea s-a schimbat în timpul verificării.');
 if(intent.payment_method&&idOf(intent.payment_method)!==params.payment_method)throw new CardConfirmationError('Cardul plății necesită verificare.');
 if(intent.status==='requires_capture'&&intent.amount_capturable===params.amount){
   db.transaction(()=>{
     const current=db.prepare('SELECT status,price_gross,credit_applied FROM jobs WHERE id=? AND client_id=?').get(jobId,userId) as typeof job|undefined;
     if(!current||current.status!=='waiting'||current.price_gross!==job.price_gross||current.credit_applied!==job.credit_applied)throw new CardConfirmationError('Rezervarea s-a schimbat în timpul confirmării.');
     db.prepare("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status,stripe_payment_intent_id) VALUES(?,?,?,?,?,'authorized',?) ON CONFLICT(id) DO NOTHING").run(params.metadata!.paymentId,jobId,split.clientAmount,split.platformAmount,split.firmAmount,intent.id);
     const rows=db.prepare('SELECT id,status,stripe_payment_intent_id FROM payments WHERE job_id=?').all(jobId) as {id:string;status:string;stripe_payment_intent_id:string}[];
     if(rows.length!==1||rows[0].id!==params.metadata!.paymentId||rows[0].status!=='authorized'||rows[0].stripe_payment_intent_id!==intent.id)throw new CardConfirmationError('Plata necesită reconciliere.');
     db.prepare("UPDATE payment_authorization_attempts SET status='requires_capture' WHERE job_id=?").run(jobId);
   })();
   return {status:'authorized' as const,amountMinor:params.amount};
 }
 const needsAuthentication=intent.status==='requires_action'||intent.status==='requires_confirmation'||(intent.status==='requires_payment_method'&&intent.last_payment_error?.code==='authentication_required');
 if(!needsAuthentication)throw new CardConfirmationError('Plata nu poate fi confirmată în această stare. Revino la lucrare.');
 if(action==='verify')return {status:'requires_action' as const,amountMinor:params.amount};
 const key=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY??'';
 const mode=/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY??'')?'live':'test';
 if(!key.startsWith(`pk_${mode}_`)||!intent.client_secret)throw new CardConfirmationError('Confirmarea cardului nu este configurată momentan.',503);
 return {status:'requires_action' as const,amountMinor:params.amount,clientSecret:intent.client_secret,paymentMethodId:params.payment_method,publishableKey:key};
}
