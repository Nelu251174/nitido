import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';
import {createHash,randomUUID} from 'node:crypto';

export const PAYMENT_RECOVERY_SCHEMA = `
CREATE TABLE IF NOT EXISTS job_acceptance_claims (
 job_id TEXT PRIMARY KEY, token TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_cancellation_requests (
 job_id TEXT PRIMARY KEY,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','needs_review')),
 last_error TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function requestPaymentCancellation(db:Database,jobId:string){
 db.transaction(()=>{
   if(db.prepare('INSERT OR IGNORE INTO payment_cancellation_requests(job_id) VALUES(?)').run(jobId).changes===1){
     db.prepare("INSERT INTO workflow_audit_log(id,event_type,job_id,details) VALUES(?,'PAYMENT_CANCELLATION_REQUESTED',?,'{}')").run(`workflow_${randomUUID()}`,jobId);
   }
 })();
}

export function authorizationMustStop(db:Database,jobId:string):boolean{
 return !!db.prepare("SELECT 1 FROM jobs WHERE id=? AND status IN ('cancelled','no_show')").get(jobId)
   || !!db.prepare('SELECT 1 FROM payment_cancellation_requests WHERE job_id=?').get(jobId);
}

/** Never creates a PaymentIntent. Unknown identities stay pending for reconciliation. */
export async function reconcilePaymentCancellation(db:Database,jobId:string,stripe:Stripe|null,options:{sandboxOnly?:boolean;beforeMutation?:()=>void}={}){
 requestPaymentCancellation(db,jobId);
 try{
   const rows=db.prepare('SELECT id,status,amount_gross,stripe_payment_intent_id FROM payments WHERE job_id=?').all(jobId) as {id:string;status:string;amount_gross:number;stripe_payment_intent_id:string|null}[];
   if(rows.length>1)throw Error('PAYMENT_CANCELLATION_RECONCILIATION_REQUIRED');
   const payment=rows[0];
   const attempt=db.prepare('SELECT request_json,provider_key_hash,stripe_payment_intent_id FROM payment_authorization_attempts WHERE job_id=?').get(jobId) as {request_json:string;provider_key_hash:string;stripe_payment_intent_id:string|null}|undefined;
   if(payment&&!['authorized','cancelled'].includes(payment.status))throw Error('PAYMENT_CANCELLATION_RECONCILIATION_REQUIRED');
   const intentId=payment?.stripe_payment_intent_id??attempt?.stripe_payment_intent_id;
   if(payment&&stripe&&!payment.stripe_payment_intent_id)throw Error('STRIPE_PAYMENT_INTENT_MISSING');
   if(attempt&&stripe&&attempt.provider_key_hash!==createHash('sha256').update(process.env.STRIPE_SECRET_KEY??'').digest('hex'))throw Error('PAYMENT_DETAILS_MISMATCH');
   if(payment&&attempt?.stripe_payment_intent_id&&payment.stripe_payment_intent_id!==attempt.stripe_payment_intent_id)throw Error('PAYMENT_DETAILS_MISMATCH');
   if(!payment&&!intentId)return; // An in-flight/unknown authorization is not evidence of cancellation.
   const params=attempt?JSON.parse(attempt.request_json) as Stripe.PaymentIntentCreateParams:null;
   const amount=payment?payment.amount_gross*100:params?.amount;
   const paymentId=payment?.id??params?.metadata?.paymentId;
   if(intentId){
     if(!stripe)throw Error('STRIPE_NOT_CONFIGURED');
     const matches=(intent:Stripe.PaymentIntent)=>intent.id===intentId&&(!options.sandboxOnly||intent.livemode===false)&&intent.currency==='ron'&&Number.isSafeInteger(amount)&&Number(amount)>0&&intent.amount===amount&&intent.metadata?.jobId===jobId&&typeof paymentId==='string'&&intent.metadata?.paymentId===paymentId;
     let intent=await stripe.paymentIntents.retrieve(intentId);
     if(!matches(intent))throw Error('PAYMENT_DETAILS_MISMATCH');
     if(intent.status!=='canceled'){
       if(!['requires_capture','requires_payment_method','requires_confirmation','requires_action'].includes(intent.status))throw Error('PAYMENT_CANCELLATION_NOT_CONFIRMED');
       options.beforeMutation?.();
       intent=await stripe.paymentIntents.cancel(intentId,{}, {idempotencyKey:`nitido-cancel-${jobId}`});
     }
     if(!matches(intent)||intent.status!=='canceled')throw Error('PAYMENT_CANCELLATION_NOT_CONFIRMED');
   }
   db.transaction(()=>{
     options.beforeMutation?.();
     if(db.prepare("SELECT 1 FROM payments WHERE job_id=? AND status NOT IN ('authorized','cancelled')").get(jobId))throw Error('PAYMENT_CANCELLATION_RECONCILIATION_REQUIRED');
     const current=db.prepare('SELECT id,amount_gross,stripe_payment_intent_id FROM payments WHERE job_id=?').all(jobId) as typeof rows;
     if(current.length>1||current.some(row=>row.id!==paymentId||row.amount_gross*100!==amount||row.stripe_payment_intent_id!==(intentId??null)))throw Error('PAYMENT_DETAILS_MISMATCH');
     const currentAttempt=db.prepare('SELECT stripe_payment_intent_id FROM payment_authorization_attempts WHERE job_id=?').get(jobId) as {stripe_payment_intent_id:string|null}|undefined;
     if(currentAttempt?.stripe_payment_intent_id&&currentAttempt.stripe_payment_intent_id!==intentId)throw Error('PAYMENT_DETAILS_MISMATCH');
     db.prepare("UPDATE payments SET status='cancelled' WHERE job_id=? AND status='authorized'").run(jobId);
     if(intentId)db.prepare("UPDATE payment_authorization_attempts SET status='canceled' WHERE job_id=? AND stripe_payment_intent_id=?").run(jobId,intentId);
     if(db.prepare("UPDATE payment_cancellation_requests SET status='processed',last_error=NULL,updated_at=datetime('now') WHERE job_id=? AND status!='processed'").run(jobId).changes===1){
       db.prepare("INSERT INTO workflow_audit_log(id,event_type,job_id,details) VALUES(?,'PAYMENT_CANCELLATION_CONFIRMED',?,?)").run(`workflow_${randomUUID()}`,jobId,JSON.stringify({intentId:intentId??null,provider:stripe?'stripe':'development'}));
     }
   })();
 }catch(error){
   // A failed concurrent retry must not downgrade a confirmed cancellation.
   db.prepare("UPDATE payment_cancellation_requests SET status='needs_review',last_error='CANCELLATION_NOT_CONFIRMED',updated_at=datetime('now') WHERE job_id=? AND status!='processed'").run(jobId);
   throw error;
 }
}
