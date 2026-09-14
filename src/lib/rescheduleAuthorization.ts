import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';
import {createHash,randomUUID} from 'node:crypto';
import type {JobRow} from './types';
import {authorizationMustStop} from './paymentCancellation';
import {authorizationCard} from './savedCards';
import {calculatePaymentSplit} from './payments';
import {WorkspaceError} from './workspace';
import {applyConfirmedReschedule,rescheduleSnapshot,type RescheduleRequest} from './rescheduling';

type Payment={id:string;job_id:string;status:string;amount_gross:number;amount_net:number;commission_amount:number;stripe_payment_intent_id:string;stripe_charge_id:string|null;stripe_transfer_id:string|null;transfer_status:string;refund_status:string;dispute_status:string};
type Attempt={job_id:string;request_json:string;provider_key_hash:string;created_ms:number;stripe_payment_intent_id:string|null;status:string};
type Replacement={request_id:string;job_id:string;payment_id:string;old_intent_id:string;new_intent_id:string|null;old_payment_json:string;old_attempt_json:string;params_json:string;provider_key_hash:string;created_ms:number;expires_ms:number;state:'open'|'applied'|'aborting'|'aborted';cleanup_status:'pending'|'done';cleanup_attempts:number};
function fail(message:string,status=409):never{throw new WorkspaceError(message,status)}
const keyHash=()=>createHash('sha256').update(process.env.STRIPE_SECRET_KEY??'').digest('hex');
const idOf=(value:string|{id:string}|null)=>typeof value==='string'?value:value?.id;
const read=(db:Database,id:string)=>db.prepare('SELECT * FROM reschedule_authorizations WHERE request_id=?').get(id) as Replacement|undefined;
const paramsOf=(row:Replacement)=>JSON.parse(row.params_json) as Stripe.PaymentIntentCreateParams;
function owner(db:Database,userId:string,jobId:string,requestId:string){
 const job=db.prepare('SELECT * FROM jobs WHERE id=? AND client_id=?').get(jobId,userId) as JobRow|undefined;
 const request=db.prepare('SELECT * FROM job_reschedule_requests WHERE id=? AND job_id=? AND client_id=?').get(requestId,jobId,userId) as RescheduleRequest|undefined;
 if(!job||!request)fail('Propunerea nu a fost găsită în contul tău.',404);
 return {job,request};
}
function eligible(db:Database,job:JobRow,request:RescheduleRequest){
 if(job.status!=='accepted'||job.express_60||authorizationMustStop(db,job.id)||request.status!=='pending'||!request.firm_confirmed_at||request.confirmed_snapshot!==rescheduleSnapshot(job)||job.scheduled_at!==request.original_at||job.accepted_firm_id!==request.firm_id)fail('Rezervarea s-a schimbat sau firma nu a confirmat propunerea. Revino la lucrare.');
 if(Date.parse(request.proposed_at)<Date.now()+3600000)fail('Intervalul propus este prea apropiat. Retrage propunerea și alege altă dată.');
}
function currentPayment(db:Database,job:JobRow){
 const rows=db.prepare('SELECT * FROM payments WHERE job_id=?').all(job.id) as Payment[];
 const p=rows[0],split=calculatePaymentSplit(job.price_gross,job.credit_applied??0);
 if(rows.length!==1||!p||!['authorized','cancelled'].includes(p.status)||!p.stripe_payment_intent_id||p.amount_gross!==split.clientAmount||p.amount_net!==split.firmAmount||p.commission_amount!==split.platformAmount||p.stripe_transfer_id||p.transfer_status!=='not_started'||p.refund_status!=='none'||p.dispute_status!=='none')fail('Plata rezervării necesită verificare înainte de reautorizare.');
 const a=db.prepare('SELECT * FROM payment_authorization_attempts WHERE job_id=?').get(job.id) as Attempt|undefined;
 if(!a||a.stripe_payment_intent_id!==p.stripe_payment_intent_id||a.provider_key_hash!==keyHash())fail('Autorizarea anterioară necesită reconciliere.');
 return {payment:p,attempt:a};
}
function matches(row:Replacement,intent:Stripe.PaymentIntent,which:'old'|'new'){
 const params=paramsOf(row),intentId=which==='old'?row.old_intent_id:row.new_intent_id;
 if(row.provider_key_hash!==keyHash()||intent.id!==intentId||intent.currency!=='ron'||intent.capture_method!=='manual'||intent.amount!==params.amount||intent.metadata.jobId!==row.job_id||intent.metadata.paymentId!==row.payment_id)fail('Identitatea autorizării nu corespunde rezervării.');
 if(which==='old'&&intent.amount_received!==0)fail('Autorizarea veche conține o încasare și necesită reconciliere.');
 const retryWithoutMethod=intent.status==='requires_payment_method'&&!intent.payment_method;
 if(which==='new'&&(intent.metadata.rescheduleRequestId!==row.request_id||idOf(intent.customer)!==params.customer||(!retryWithoutMethod&&idOf(intent.payment_method)!==params.payment_method)))fail('Cardul autorizării nu corespunde rezervării.');
}
function clientState(row:Replacement,intent:Stripe.PaymentIntent){
 matches(row,intent,'new');
 if(!['requires_confirmation','requires_action','requires_payment_method'].includes(intent.status))fail('Banca nu a confirmat încă autorizarea. Reîncarcă starea plății.');
 const publishableKey=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY??'';
 const mode=/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY??'')?'live':'test';
 if(!publishableKey.startsWith(`pk_${mode}_`)||!intent.client_secret)fail('Confirmarea cardului nu este configurată.',503);
 return {status:'requires_action' as const,amountMinor:paramsOf(row).amount,clientSecret:intent.client_secret,paymentMethodId:paramsOf(row).payment_method as string,publishableKey};
}
function audit(db:Database,row:Replacement,event:string){
 db.prepare('INSERT INTO workflow_audit_log(id,event_type,job_id,details) VALUES(?,?,?,?)').run(`workflow_${randomUUID()}`,event,row.job_id,JSON.stringify({requestId:row.request_id,oldIntentId:row.old_intent_id,newIntentId:row.new_intent_id}));
}

/** A read-only start never creates an intent. Only the owner's explicit begin records consent. */
export async function rescheduleAuthorization(db:Database,stripe:Stripe,userId:string,jobId:string,requestId:string,action:'start'|'begin'|'verify'){
 const {job,request}=owner(db,userId,jobId,requestId);
 let row=read(db,requestId);
 if(row?.state==='applied')return {status:'authorized' as const,amountMinor:paramsOf(row).amount,scheduledAt:request.proposed_at,cleanupPending:row.cleanup_status!=='done'};
 if(row&&row.state!=='open')fail('Această autorizare a fost închisă. Retrage propunerea și creează una nouă.');
 eligible(db,job,request);
 const {payment,attempt}=currentPayment(db,job);
 if(Date.parse(request.proposed_at)>Date.now()+48*3600000)return {status:'waiting_window' as const,amountMinor:payment.amount_gross*100,availableAt:new Date(Date.parse(request.proposed_at)-48*3600000).toISOString(),scheduledAt:request.proposed_at};
 if(!row&&action!=='begin')return {status:'consent_required' as const,amountMinor:payment.amount_gross*100,scheduledAt:request.proposed_at};
 if(!row){
  if(db.prepare("SELECT 1 FROM reschedule_authorizations WHERE job_id=? AND state='applied' AND cleanup_status='pending'").get(jobId))fail('Eliberarea autorizării precedente este încă în curs. Reîncarcă starea plății peste câteva minute.');
  // Check the processor's old identity before asking the owner to authorize another hold.
  const old=await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
  if(old.metadata.jobId!==jobId||old.metadata.paymentId!==payment.id||old.amount!==payment.amount_gross*100||old.currency!=='ron'||old.capture_method!=='manual'||old.amount_received!==0||!['requires_capture','canceled'].includes(old.status)||(old.status==='requires_capture'&&old.amount_capturable!==old.amount))fail('Autorizarea existentă necesită verificare.');
  row=db.transaction(()=>{
   const current=owner(db,userId,jobId,requestId);eligible(db,current.job,current.request);
   const latest=currentPayment(db,current.job);
   if(latest.payment.stripe_payment_intent_id!==payment.stripe_payment_intent_id||rescheduleSnapshot(current.job)!==rescheduleSnapshot(job))fail('Rezervarea s-a schimbat. Reîncarcă pagina.');
   const existing=read(db,requestId);if(existing)return existing;
   if(db.prepare("SELECT 1 FROM reschedule_authorizations WHERE job_id=? AND state='applied' AND cleanup_status='pending'").get(jobId))fail('Eliberarea autorizării precedente este încă în curs.');
   // Reuse the card chosen for this job. No card number is handled by the application.
   const card=authorizationCard(db,jobId);
   const params:Stripe.PaymentIntentCreateParams={amount:payment.amount_gross*100,currency:'ron',capture_method:'manual',customer:card.customerId,payment_method:card.paymentMethodId,confirm:false,metadata:{jobId,paymentId:payment.id,rescheduleRequestId:requestId,pricingSource:'server'}};
   const now=Date.now();
   db.prepare(`INSERT INTO reschedule_authorizations(request_id,job_id,payment_id,old_intent_id,old_payment_json,old_attempt_json,params_json,provider_key_hash,created_ms,expires_ms) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(requestId,jobId,payment.id,payment.stripe_payment_intent_id,JSON.stringify(payment),JSON.stringify(attempt),JSON.stringify(params),keyHash(),now,now+30*60000);
   const created=read(db,requestId)!;audit(db,created,'RESCHEDULE_AUTHORIZATION_CONSENT');return created;
  }).immediate();
 }
 if(row.state!=='open'||row.provider_key_hash!==keyHash()||row.old_intent_id!==payment.stripe_payment_intent_id)fail('Autorizarea necesită reconciliere.');
 if(row.expires_ms<=Date.now()){
  await cleanupRescheduleAuthorization(db,stripe,requestId);
  fail('Sesiunea de autorizare a expirat. Retrage propunerea și creează una nouă.');
 }
 if(!row.new_intent_id){
  if(action!=='begin')return {status:'consent_required' as const,amountMinor:paramsOf(row).amount,scheduledAt:request.proposed_at};
  // Never confirm here: an unknown create outcome cannot put a hold on the card.
  // Retrying uses immutable parameters and the same key, within the 30-minute session.
  const intent=await stripe.paymentIntents.create(paramsOf(row),{idempotencyKey:`nitido-reschedule-${requestId}`});
  const candidate={...row,new_intent_id:intent.id};matches(candidate,intent,'new');
  db.prepare('UPDATE reschedule_authorizations SET new_intent_id=? WHERE request_id=? AND new_intent_id IS NULL').run(intent.id,requestId);
  row=read(db,requestId)!;
  if(row.new_intent_id!==intent.id)fail('Identitatea autorizării necesită reconciliere.');
 }
 const intent=await stripe.paymentIntents.retrieve(row.new_intent_id!,{expand:['latest_charge']});
 matches(row,intent,'new');
 const state=read(db,requestId)!;
 if(state.state==='applied')return {status:'authorized' as const,amountMinor:paramsOf(row).amount,scheduledAt:request.proposed_at,cleanupPending:state.cleanup_status!=='done'};
 const latest=owner(db,userId,jobId,requestId);eligible(db,latest.job,latest.request);
 if(read(db,requestId)?.state!=='open'||Date.now()>=row.expires_ms)fail('Sesiunea a fost închisă. Revino la rezervare.');
 if(intent.status==='requires_capture'){
  await finishRescheduleAuthorization(db,stripe,row,intent);
  const applied=read(db,requestId)!;
  return {status:'authorized' as const,amountMinor:paramsOf(row).amount,scheduledAt:request.proposed_at,cleanupPending:applied.cleanup_status!=='done'};
 }
 return {...clientState(row,intent),scheduledAt:request.proposed_at};
}

/** Swap the current payment and date together BEFORE releasing the old hold.
 * A concurrent arrival/cancellation therefore sees either the complete old state or the complete new one.
 * The old intent remains durably tracked until Stripe confirms its cancellation. */
async function finishRescheduleAuthorization(db:Database,stripe:Stripe,row:Replacement,intent:Stripe.PaymentIntent){
 matches(row,intent,'new');
 const charge=typeof intent.latest_charge==='object'?intent.latest_charge:null;
 const expiry=charge?.payment_method_details?.card?.capture_before;
 const request=db.prepare('SELECT * FROM job_reschedule_requests WHERE id=?').get(row.request_id) as RescheduleRequest;
 try{
  const old=await stripe.paymentIntents.retrieve(row.old_intent_id);matches(row,old,'old');
  if(!['requires_capture','canceled'].includes(old.status)||(old.status==='requires_capture'&&old.amount_capturable!==old.amount))fail('Autorizarea veche nu mai poate fi înlocuită. Plata necesită reconciliere.');
  db.transaction(()=>{
   const fresh=read(db,row.request_id)!;if(fresh.state==='applied')return;
   if(fresh.state!=='open'||fresh.new_intent_id!==intent.id||Date.now()>=fresh.expires_ms)fail('Sesiunea a expirat sau a fost închisă.');
   const {job,request:current}=owner(db,request.client_id,row.job_id,row.request_id);eligible(db,job,current);
   const {payment,attempt}=currentPayment(db,job);
   if(payment.id!==row.payment_id||payment.stripe_payment_intent_id!==row.old_intent_id||attempt.stripe_payment_intent_id!==row.old_intent_id||payment.amount_gross*100!==intent.amount)fail('Plata rezervării s-a schimbat.');
   const end=Date.parse(current.proposed_at)+(job.duration_minutes+job.buffer_minutes)*60000;
   if(intent.status!=='requires_capture'||intent.amount_capturable!==intent.amount||!expiry||expiry*1000<=end)fail('Noua autorizare nu acoperă durata lucrării. Alege alt interval.');
   applyConfirmedReschedule(db,job,current);
   db.prepare("UPDATE payments SET stripe_payment_intent_id=?,status='authorized',stripe_charge_id=NULL,stripe_fee_amount=NULL WHERE id=? AND stripe_payment_intent_id=?").run(intent.id,payment.id,row.old_intent_id);
   db.prepare("UPDATE payment_authorization_attempts SET request_json=?,provider_key_hash=?,created_ms=?,stripe_payment_intent_id=?,status='requires_capture' WHERE job_id=? AND stripe_payment_intent_id=?").run(row.params_json,row.provider_key_hash,row.created_ms,intent.id,row.job_id,row.old_intent_id);
   db.prepare("UPDATE job_reschedule_requests SET status='accepted',resolved_at=? WHERE id=? AND status='pending'").run(new Date().toISOString(),row.request_id);
   db.prepare("UPDATE reschedule_authorizations SET state='applied',applied_at=?,retry_after_ms=0,last_error=NULL WHERE request_id=? AND state='open'").run(new Date().toISOString(),row.request_id);
   audit(db,row,'RESCHEDULE_AUTHORIZATION_APPLIED');
  }).immediate();
 }catch(error){
  // A failed slot/budget check rolls back the entire swap; release only the unused new hold.
  db.prepare("UPDATE reschedule_authorizations SET state='aborting',retry_after_ms=0 WHERE request_id=? AND state='open'").run(row.request_id);
  await cleanupRescheduleAuthorization(db,stripe,row.request_id).catch(()=>{});
  throw error;
 }
 await cleanupRescheduleAuthorization(db,stripe,row.request_id).catch(()=>{});
}

/** Exact, known intents only. No authorizations, captures, transfers or refunds are created by recovery. */
export async function cleanupRescheduleAuthorization(db:Database,stripe:Stripe,requestId:string){
 let row=read(db,requestId);if(!row||row.cleanup_status==='done')return;
 if(row.state==='open'){
  const request=db.prepare('SELECT * FROM job_reschedule_requests WHERE id=?').get(requestId) as RescheduleRequest;
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(row.job_id) as JobRow;
  let valid=true;try{eligible(db,job,request)}catch{valid=false}
  if(valid&&Date.now()<row.expires_ms)return;
  db.prepare("UPDATE reschedule_authorizations SET state='aborting' WHERE request_id=? AND state='open'").run(requestId);
  row=read(db,requestId)!;
 }
 const which=row.state==='applied'?'old':'new';
 const intentId=which==='old'?row.old_intent_id:row.new_intent_id;
 // An unknown create outcome was never confirmed. Keep it recorded for support;
 // never recreate it from a background job after its idempotency window.
 if(!intentId)return;
 try{
  if(db.prepare('SELECT 1 FROM payments WHERE stripe_payment_intent_id=?').get(intentId))fail('Autorizarea este încă folosită de o rezervare.');
  let intent=await stripe.paymentIntents.retrieve(intentId);matches(row,intent,which);
  if(intent.status!=='canceled'){
   if(!['requires_capture','requires_confirmation','requires_action','requires_payment_method'].includes(intent.status))fail('Eliberarea autorizării nu a fost confirmată.');
   intent=await stripe.paymentIntents.cancel(intentId,{}, {idempotencyKey:`nitido-reschedule-release-${requestId}-${which}`});
  }
  matches(row,intent,which);if(intent.status!=='canceled')fail('Eliberarea autorizării nu a fost confirmată.');
  db.transaction(()=>{
   const changed=db.prepare("UPDATE reschedule_authorizations SET cleanup_status='done',state=CASE WHEN state='applied' THEN state ELSE 'aborted' END,last_error=NULL WHERE request_id=? AND cleanup_status='pending'").run(requestId).changes;
   if(changed)audit(db,row!,which==='old'?'RESCHEDULE_OLD_AUTHORIZATION_RELEASED':'RESCHEDULE_UNUSED_AUTHORIZATION_RELEASED');
  }).immediate();
 }catch(error){
  const delay=Math.min(3600000,30000*2**Math.min(row.cleanup_attempts,7));
  db.prepare("UPDATE reschedule_authorizations SET cleanup_attempts=cleanup_attempts+1,retry_after_ms=?,last_error='RELEASE_NOT_CONFIRMED' WHERE request_id=? AND cleanup_status='pending'").run(Date.now()+delay,requestId);
  throw error;
 }
}

/** Bounded backstop, invoked by the existing five-minute recurring task. */
export async function recoverRescheduleAuthorizations(db:Database,stripe:Stripe){
 const rows=db.prepare(`SELECT a.request_id FROM reschedule_authorizations a
 JOIN job_reschedule_requests r ON r.id=a.request_id JOIN jobs j ON j.id=a.job_id
 WHERE a.cleanup_status='pending' AND a.retry_after_ms<=? AND (a.new_intent_id IS NOT NULL OR a.state='applied')
 AND (a.state!='open' OR a.expires_ms<=? OR r.status!='pending' OR j.status!='accepted'
 OR j.scheduled_at!=r.original_at OR j.accepted_firm_id!=r.firm_id
 OR EXISTS(SELECT 1 FROM payment_cancellation_requests c WHERE c.job_id=a.job_id))
 ORDER BY a.retry_after_ms,a.created_ms LIMIT 5`).all(Date.now(),Date.now()) as {request_id:string}[];
 let processed=0,blocked=0;
 for(const {request_id} of rows){try{await cleanupRescheduleAuthorization(db,stripe,request_id);if(read(db,request_id)?.cleanup_status==='done')processed++}catch{blocked++}}
 return {processed,blocked};
}
