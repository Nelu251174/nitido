import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';
import {createHash,randomUUID} from 'node:crypto';
import type {JobTiming} from './firmAvailability';

export {CONFIRMATION_WINDOW_HOURS,AUTHORIZATION_POLICY_VERSION,AUTHORIZATION_NOTICE,confirmationOpensAt} from './authorizationPolicy';
export const AUTHORIZATION_COVERAGE_SCHEMA=`
CREATE TABLE IF NOT EXISTS authorization_coverage (
 intent_id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),payment_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL,provider_key_hash TEXT NOT NULL,required_until_ms INTEGER NOT NULL,capture_before_ms INTEGER,
 state TEXT NOT NULL CHECK(state IN ('verified','release_pending','released','needs_review')),
 attempts INTEGER NOT NULL DEFAULT 0,next_retry_ms INTEGER NOT NULL DEFAULT 0,lease_token TEXT,lease_until_ms INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,created_ms INTEGER NOT NULL,updated_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS authorization_coverage_pending ON authorization_coverage(state,next_retry_ms);
`;
export class AuthorizationCoverageError extends Error{
 constructor(public code:'HOLD_COVERAGE_UNCONFIRMED'|'HOLD_RELEASE_PENDING'){super(code)}
}
type Coverage={intent_id:string;job_id:string;payment_id:string;amount_minor:number;provider_key_hash:string;required_until_ms:number;capture_before_ms:number|null;state:string;attempts:number;next_retry_ms:number;lease_token:string|null;lease_until_ms:number};
const keyHash=()=>createHash('sha256').update(process.env.STRIPE_SECRET_KEY??'').digest('hex');
export function authorizationRequiredUntil(job:JobTiming,now=Date.now()){
 const start=Date.parse(job.scheduled_at??'');
 if(!Number.isSafeInteger(job.duration_minutes)||job.duration_minutes<=0||!Number.isSafeInteger(job.buffer_minutes)||job.buffer_minutes<0||(!Number.isFinite(start)&&!(job.when_type==='asap'&&job.scheduled_at===null)))throw Error('INVALID_AUTHORIZATION_SCHEDULE');
 const end=Math.max(Number.isFinite(start)?start:now,now)+(job.duration_minutes+job.buffer_minutes)*60000;
 if(!Number.isSafeInteger(end))throw Error('INVALID_AUTHORIZATION_SCHEDULE');return end;
}
function matches(intent:Stripe.PaymentIntent,row:Pick<Coverage,'intent_id'|'job_id'|'payment_id'|'amount_minor'>){
 return intent.id===row.intent_id&&intent.currency==='ron'&&intent.amount===row.amount_minor&&intent.capture_method==='manual'&&intent.amount_received===0&&intent.metadata?.jobId===row.job_id&&intent.metadata?.paymentId===row.payment_id;
}
/** Releases only a known, unused failed authorization. Never touches a payment used by a booking. */
export async function releaseUncoveredAuthorization(db:Database,stripe:Stripe,intentId:string,now=Date.now()){
 const token=randomUUID();
 const row=db.transaction(()=>{
  const value=db.prepare('SELECT * FROM authorization_coverage WHERE intent_id=?').get(intentId) as Coverage|undefined;
  if(!value||value.state!=='release_pending'||value.next_retry_ms>now||value.lease_until_ms>now)return null;
  if(value.provider_key_hash!==keyHash()||db.prepare('SELECT 1 FROM payments WHERE stripe_payment_intent_id=? OR job_id=?').get(intentId,value.job_id)||db.prepare("SELECT 1 FROM jobs WHERE id=? AND status IN ('arrived','completed')").get(value.job_id)){
   db.prepare("UPDATE authorization_coverage SET state='needs_review',last_error='IDENTITY_OR_PAYMENT_REVIEW',updated_ms=? WHERE intent_id=?").run(now,intentId);return null;
  }
  if(!db.prepare("UPDATE authorization_coverage SET lease_token=?,lease_until_ms=?,attempts=attempts+1 WHERE intent_id=? AND state='release_pending' AND lease_until_ms<=?").run(token,now+120000,intentId,now).changes)return null;
  return {...value,attempts:value.attempts+1};
 }).immediate();
 if(!row)return;
 const checkLease=()=>{if(!db.prepare("SELECT 1 FROM authorization_coverage WHERE intent_id=? AND lease_token=? AND state='release_pending' AND lease_until_ms>?").get(intentId,token,Date.now())||db.prepare('SELECT 1 FROM payments WHERE stripe_payment_intent_id=? OR job_id=?').get(intentId,row.job_id))throw Error('COVERAGE_RELEASE_REVIEW_REQUIRED')};
 try{
  let intent=await stripe.paymentIntents.retrieve(intentId);
  if(!matches(intent,row))throw Error('COVERAGE_IDENTITY_MISMATCH');
  if(intent.status!=='canceled'){
   if(intent.status!=='requires_capture'||intent.amount_capturable!==row.amount_minor)throw Error('COVERAGE_RELEASE_NOT_CONFIRMED');
   checkLease();intent=await stripe.paymentIntents.cancel(intentId,{}, {idempotencyKey:`nitido-uncovered-release-${intentId}`});
  }
  if(!matches(intent,row)||intent.status!=='canceled')throw Error('COVERAGE_RELEASE_NOT_CONFIRMED');
  db.transaction(()=>{
   checkLease();db.prepare("UPDATE authorization_coverage SET state='released',lease_token=NULL,lease_until_ms=0,last_error=NULL,updated_ms=? WHERE intent_id=? AND lease_token=?").run(Date.now(),intentId,token);
   db.prepare("UPDATE payment_authorization_attempts SET status='coverage_released' WHERE job_id=? AND stripe_payment_intent_id=?").run(row.job_id,intentId);
  }).immediate();
 }catch{
  db.prepare("UPDATE authorization_coverage SET state=CASE WHEN attempts>=8 THEN 'needs_review' ELSE state END,lease_token=NULL,lease_until_ms=0,next_retry_ms=?,last_error='RELEASE_NOT_CONFIRMED',updated_ms=? WHERE intent_id=? AND lease_token=? AND state='release_pending'").run(Date.now()+Math.min(3600000,30000*2**Math.min(row.attempts-1,7)),Date.now(),intentId,token);
 }
}
/** No new intent may replace a blocked/released authorization automatically. */
export async function assertCoverageAttemptReusable(db:Database,stripe:Stripe,jobId:string){
 const row=db.prepare("SELECT * FROM authorization_coverage WHERE job_id=? AND state!='verified' ORDER BY created_ms DESC LIMIT 1").get(jobId) as Coverage|undefined;
 if(!row)return;
 if(row.state==='release_pending')await releaseUncoveredAuthorization(db,stripe,row.intent_id);
 const fresh=db.prepare('SELECT state FROM authorization_coverage WHERE intent_id=?').get(row.intent_id) as {state:string};
 throw new AuthorizationCoverageError(fresh.state==='release_pending'?'HOLD_RELEASE_PENDING':'HOLD_COVERAGE_UNCONFIRMED');
}
/** Existing Stripe integration, manual capture. Only the processor's actual deadline is evidence. */
export async function ensureAuthorizationCoverage(db:Database,stripe:Stripe,intent:Stripe.PaymentIntent,input:{jobId:string;paymentId:string;amountMinor:number;requiredUntil:number}){
 const identity={intent_id:intent.id,job_id:input.jobId,payment_id:input.paymentId,amount_minor:input.amountMinor};
 const expanded=await stripe.paymentIntents.retrieve(intent.id,{expand:['latest_charge']});
 if(!matches(expanded,identity)||expanded.status!=='requires_capture'||expanded.amount_capturable!==input.amountMinor)throw Error('PAYMENT_AUTHORIZATION_NOT_CONFIRMED');
 const charge=expanded.latest_charge&&typeof expanded.latest_charge==='object'?expanded.latest_charge:null;
 const deadline=charge?.payment_method_details?.card?.capture_before;
 const expiry=typeof deadline==='number'&&Number.isSafeInteger(deadline)&&deadline>0&&Number.isSafeInteger(deadline*1000)?deadline*1000:null;
 const covered=expiry!==null&&expiry>Math.max(input.requiredUntil,Date.now());
 const inUse=!!db.prepare('SELECT 1 FROM payments WHERE stripe_payment_intent_id=? OR job_id=?').get(intent.id,input.jobId);
 const state=covered?'verified':inUse?'needs_review':'release_pending';
 db.prepare(`INSERT INTO authorization_coverage(intent_id,job_id,payment_id,amount_minor,provider_key_hash,required_until_ms,capture_before_ms,state,created_ms,updated_ms)
 VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(intent_id) DO UPDATE SET required_until_ms=excluded.required_until_ms,capture_before_ms=excluded.capture_before_ms,state=CASE WHEN authorization_coverage.state='verified' THEN excluded.state ELSE authorization_coverage.state END,updated_ms=excluded.updated_ms`).run(intent.id,input.jobId,input.paymentId,input.amountMinor,keyHash(),input.requiredUntil,expiry,state,Date.now(),Date.now());
 const persisted=db.prepare('SELECT state FROM authorization_coverage WHERE intent_id=?').get(intent.id) as {state:string};
 if(covered&&persisted.state==='verified')return;
 db.prepare("UPDATE payment_authorization_attempts SET status='coverage_blocked' WHERE job_id=? AND stripe_payment_intent_id=?").run(input.jobId,intent.id);
 if(!inUse)await releaseUncoveredAuthorization(db,stripe,intent.id);
 const fresh=db.prepare('SELECT state FROM authorization_coverage WHERE intent_id=?').get(intent.id) as {state:string};
 throw new AuthorizationCoverageError(fresh.state==='release_pending'?'HOLD_RELEASE_PENDING':'HOLD_COVERAGE_UNCONFIRMED');
}
export async function recoverAuthorizationCoverage(db:Database,stripe:Stripe){
 const rows=db.prepare("SELECT intent_id FROM authorization_coverage WHERE state='release_pending' AND next_retry_ms<=? AND lease_until_ms<=? ORDER BY created_ms LIMIT 5").all(Date.now(),Date.now()) as {intent_id:string}[];
 let released=0;for(const row of rows){await releaseUncoveredAuthorization(db,stripe,row.intent_id);if((db.prepare('SELECT state FROM authorization_coverage WHERE intent_id=?').get(row.intent_id) as {state:string}).state==='released')released++}
 return {attempted:rows.length,released};
}
