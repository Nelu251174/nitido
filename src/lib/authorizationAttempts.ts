import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';
import {createHash} from 'node:crypto';

/** Persist before contacting Stripe. Unknown outcomes are retried only inside a conservative 20-hour window. */
export async function obtainAuthorization(db:Database,stripe:Stripe,jobId:string,params:Stripe.PaymentIntentCreateParams):Promise<Stripe.PaymentIntent>{
 const request=JSON.stringify(params),keyHash=createHash('sha256').update(process.env.STRIPE_SECRET_KEY??'').digest('hex');
 db.prepare('INSERT OR IGNORE INTO payment_authorization_attempts(job_id,request_json,provider_key_hash,created_ms) VALUES(?,?,?,?)').run(jobId,request,keyHash,Date.now());
 const attempt=db.prepare('SELECT * FROM payment_authorization_attempts WHERE job_id=?').get(jobId) as {request_json:string;provider_key_hash:string;created_ms:number;stripe_payment_intent_id:string|null};
 const reconciliationRequired=()=>{db.prepare("UPDATE payment_authorization_attempts SET status='reconciliation_required' WHERE job_id=?").run(jobId);return Error('PAYMENT_AUTHORIZATION_RECONCILIATION_REQUIRED');};
 if(attempt.request_json!==request||attempt.provider_key_hash!==keyHash)throw reconciliationRequired();
 let intent:Stripe.PaymentIntent;
 if(attempt.stripe_payment_intent_id){
   intent=await stripe.paymentIntents.retrieve(attempt.stripe_payment_intent_id);
 }else{
   const age=Date.now()-attempt.created_ms;
   if(age<0||age>=20*60*60*1000)throw reconciliationRequired();
   try{intent=await stripe.paymentIntents.create(params,{idempotencyKey:`nitido-authorize-${jobId}`});}
   catch(error){
     db.prepare("UPDATE payment_authorization_attempts SET status='unknown' WHERE job_id=? AND stripe_payment_intent_id IS NULL").run(jobId);
     const candidate=error&&typeof error==='object'&&'payment_intent' in error?error.payment_intent:null;
     if(candidate&&typeof candidate==='object'&&'id' in candidate&&'metadata' in candidate){
       const intent=candidate as Stripe.PaymentIntent;
       if(typeof intent.id==='string'&&intent.amount===params.amount&&intent.currency===params.currency&&intent.metadata?.jobId===jobId&&intent.metadata?.paymentId===params.metadata?.paymentId){
         const authenticationRequired=error!==null&&typeof error==='object'&&'code' in error&&error.code==='authentication_required';
         db.prepare('UPDATE payment_authorization_attempts SET stripe_payment_intent_id=?,status=? WHERE job_id=?').run(intent.id,authenticationRequired?'requires_action':intent.status,jobId);
       }
     }
     throw error;
   }
 }
 if(intent.amount!==params.amount||intent.currency!==params.currency||intent.metadata.jobId!==jobId||intent.metadata.paymentId!==params.metadata?.paymentId||(attempt.stripe_payment_intent_id&&intent.id!==attempt.stripe_payment_intent_id))throw Error('PAYMENT_DETAILS_MISMATCH');
 db.prepare('UPDATE payment_authorization_attempts SET stripe_payment_intent_id=?,status=? WHERE job_id=?').run(intent.id,intent.status==='requires_payment_method'&&intent.last_payment_error?.code==='authentication_required'?'requires_action':intent.status,jobId);
 return intent;
}
