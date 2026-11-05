import {authorizationMoney,ensurePaymentMoneySchema,moneyFromPayment,paymentCurrency,type PaymentMoney} from './paymentMoney';
import {serviceCountry} from './serviceMarkets';
import {assertCoverageAttemptReusable,ensureAuthorizationCoverage} from './authorizationCoverage';
import {authorizationCard} from "./savedCards";
import type { Database } from "better-sqlite3";
import Stripe from "stripe";
import {obtainAuthorization} from "@/lib/authorizationAttempts";
import {authorizationMustStop,reconcilePaymentCancellation,requestPaymentCancellation} from "@/lib/paymentCancellation";
import { createHash } from "node:crypto";
import { calcNetForFirm, PLATFORM_COMMISSION } from "@/lib/pricing";
import { assertCompletionProof, auditWorkflow } from "@/lib/proofOfWork";

export type TransferStatus = "not_started" | "blocked" | "pending" | "processed" | "failed" | "reversed";

function sameMoney(row:Record<string,unknown>,expected:PaymentMoney){
  const actual=moneyFromPayment(row);
  return actual.currency===expected.currency&&actual.clientAmountMinor===expected.clientAmountMinor&&actual.firmAmountMinor===expected.firmAmountMinor&&actual.platformAmountMinor===expected.platformAmountMinor;
}
function refundHasMoney(row:Record<string,unknown>,money:PaymentMoney){
  if(paymentCurrency(row.currency,true)!==money.currency)return false;
  const amount=row.amount_minor===null||row.amount_minor===undefined?(money.currency==='RON'?Number(row.amount)*100:null):row.amount_minor;
  return Number.isSafeInteger(amount)&&amount===money.clientAmountMinor;
}

export function getStripeClient(options?: Stripe.StripeConfig): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("STRIPE_SECRET_KEY lipsește în production");
    return null;
  }
  return new Stripe(key,options);
}

export function connectTransfersEnabled(): boolean {
  return process.env.NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED === "true";
}

export function calculatePaymentSplit(grossAmount: number, discountAmount = 0) {
  const firmAmount = calcNetForFirm(grossAmount);
  const clientAmount = Math.max(firmAmount, grossAmount - Math.max(0, discountAmount));
  return { clientAmount, firmAmount, platformAmount: clientAmount - firmAmount };
}

/** Authorize the authoritative client amount on the platform. No transfer is made here. */
export async function authorizePayment(db: Database, jobId: string, grossAmount: number, _firmAccountId?: string | null, discountAmount = 0, onAuthorized?: (paymentId: string) => void, coverage?:{requiredUntil:number}): Promise<string> {
  ensurePaymentMoneySchema(db);
  const stripe=getStripeClient();
  const stopCancelledAuthorization=async()=>{
    if(!authorizationMustStop(db,jobId))return;
    await reconcilePaymentCancellation(db,jobId,stripe);
    throw Error('PAYMENT_AUTHORIZATION_CANCELLED');
  };
  if(authorizationMustStop(db,jobId))await stopCancelledAuthorization();
  if(stripe&&coverage)await assertCoverageAttemptReusable(db,stripe,jobId);
  const rows=db.prepare("SELECT * FROM payments WHERE job_id=?").all(jobId) as (Record<string,unknown>&{id:string;status:string;amount_gross:number;stripe_payment_intent_id:string|null})[];
  if(rows.length>1)throw new Error("PAYMENT_AUTHORIZATION_RECONCILIATION_REQUIRED");
  const existing=rows[0];
  const money=authorizationMoney(db,jobId,grossAmount,discountAmount,!existing);
  const {clientAmount,firmAmount,platformAmount}=money;
  if(existing){
    if(existing.status!=="authorized")throw new Error("PAYMENT_NOT_AUTHORIZED");
    if(existing.amount_gross!==clientAmount||moneyFromPayment(existing).currency!==money.currency)throw new Error("PAYMENT_DETAILS_MISMATCH");
    if(stripe){
      if(!existing.stripe_payment_intent_id)throw new Error("STRIPE_PAYMENT_INTENT_MISSING");
      const intent=await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);
      if(authorizationMustStop(db,jobId))await stopCancelledAuthorization();
      if(intent.id!==existing.stripe_payment_intent_id||intent.currency!==money.stripeCurrency||intent.amount!==money.clientAmountMinor||intent.metadata.jobId!==jobId||intent.metadata.paymentId!==existing.id)throw new Error("PAYMENT_DETAILS_MISMATCH");
      if(intent.status==="canceled"){
        db.transaction(()=>{db.prepare("UPDATE payments SET status='cancelled' WHERE id=? AND status='authorized'").run(existing.id);db.prepare("UPDATE payment_authorization_attempts SET status='canceled' WHERE stripe_payment_intent_id=?").run(existing.stripe_payment_intent_id);})();
        throw new Error("PAYMENT_AUTHORIZATION_EXPIRED_OR_CANCELLED");
      }
      if(intent.status!=="requires_capture"||intent.amount_capturable!==money.clientAmountMinor)throw new Error("PAYMENT_AUTHORIZATION_NOT_CONFIRMED");
      if(coverage)await ensureAuthorizationCoverage(db,stripe,intent,{jobId,paymentId:existing.id,amountMinor:money.clientAmountMinor,currency:money.currency,requiredUntil:coverage.requiredUntil});
    }
    db.transaction(()=>{
      if(authorizationMustStop(db,jobId))throw Error('PAYMENT_AUTHORIZATION_CANCELLED');
    const current=db.prepare("SELECT * FROM payments WHERE id=?").get(existing.id) as typeof existing|undefined;
    if(!current||current.status!=='authorized'||current.stripe_payment_intent_id!==existing.stripe_payment_intent_id||current.amount_gross!==clientAmount||!sameMoney(current,money))throw Error('PAYMENT_AUTHORIZATION_RECONCILIATION_REQUIRED');
      onAuthorized?.(existing.id);
    }).immediate();
    return existing.id;
  }
  // Stable metadata across retries after an uncertain provider response.
  const id=`pay_${createHash("sha256").update(jobId).digest("hex")}`;
  let intentId:string|null=null;
  if(stripe){
    // HOLD pe cardul salvat al clientului (card pe fișier — vezi clientPayments.ts).
    // off_session + confirm = autorizare imediată fără ca clientul să fie prezent;
    // capture_method:manual = doar rezervare, se încasează abia la finalizare.
    const client=authorizationCard(db,jobId);
    let intent:Stripe.PaymentIntent;
    try{intent=await obtainAuthorization(db,stripe,jobId,{
      amount:money.clientAmountMinor,
      currency:money.stripeCurrency,
      customer:client.customerId,
      payment_method:client.paymentMethodId,
      off_session:true,
      confirm:true,
      capture_method:"manual",
      metadata:{jobId,paymentId:id,pricingSource:"server",...(money.currency==='EUR'?{firmId:(db.prepare('SELECT accepted_firm_id FROM jobs WHERE id=?').get(jobId) as {accepted_firm_id:string|null}|undefined)?.accepted_firm_id??''}:{})},
    });}catch(error){
      if(authorizationMustStop(db,jobId))await stopCancelledAuthorization();
      throw error;
    }
    if(authorizationMustStop(db,jobId))await stopCancelledAuthorization();
    if(intent.status!=="requires_capture" || intent.currency!==money.stripeCurrency || intent.amount!==money.clientAmountMinor || intent.amount_capturable!==money.clientAmountMinor) throw new Error("PAYMENT_AUTHORIZATION_NOT_CONFIRMED");
    if(coverage)await ensureAuthorizationCoverage(db,stripe,intent,{jobId,paymentId:id,amountMinor:money.clientAmountMinor,currency:money.currency,requiredUntil:coverage.requiredUntil});
    intentId=intent.id;
  }
  try{db.transaction(()=>{
    if(authorizationMustStop(db,jobId))throw Error('PAYMENT_AUTHORIZATION_CANCELLED');
    db.prepare(`INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status,stripe_payment_intent_id,currency,amount_gross_minor,commission_amount_minor,amount_net_minor) VALUES(?,?,?,?,?,'authorized',?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run(id,jobId,clientAmount,platformAmount,firmAmount,intentId,money.currency,money.clientAmountMinor,money.platformAmountMinor,money.firmAmountMinor);
    const saved=db.prepare("SELECT * FROM payments WHERE id=?").get(id) as Record<string,unknown>|undefined;
    if(!saved||saved.status!=="authorized"||saved.stripe_payment_intent_id!==intentId||saved.amount_gross!==clientAmount||!sameMoney(saved,money))throw new Error("PAYMENT_AUTHORIZATION_RECONCILIATION_REQUIRED");
    onAuthorized?.(id);
  })();}catch(error){
    if(authorizationMustStop(db,jobId))await stopCancelledAuthorization();
    throw error;
  }
  return id;
}

/** Capture once, then initiate one server-derived transfer only when Connect is explicitly enabled and ready. */
export async function capturePayment(db:Database,jobId:string):Promise<void>{
  ensurePaymentMoneySchema(db);
  const {firmId}=assertCompletionProof(db,jobId);
  const payment=db.prepare("SELECT * FROM payments WHERE job_id=?").get(jobId) as Record<string,unknown>|undefined;
  if(!payment)throw new Error("PAYMENT_NOT_AUTHORIZED");
  const money=moneyFromPayment(payment);
  if(payment.status==="captured")return;
  if(payment.status!=="authorized")throw new Error("PAYMENT_NOT_AUTHORIZED");
  const stripe=getStripeClient();
  let chargeId:string|null=(payment.stripe_charge_id as string|null)??null;
  if(stripe){
    if(!payment.stripe_payment_intent_id)throw new Error("STRIPE_PAYMENT_INTENT_MISSING");
    const intentId=String(payment.stripe_payment_intent_id);
    let intent=await stripe.paymentIntents.retrieve(intentId);
    const matchesPayment=(value:Stripe.PaymentIntent)=>value.id===intentId && value.currency===money.stripeCurrency && value.amount===money.clientAmountMinor && value.metadata.jobId===jobId && value.metadata.paymentId===payment.id;
    if(!matchesPayment(intent))throw new Error("PAYMENT_DETAILS_MISMATCH");
    if(intent.status==="canceled"){
      db.transaction(()=>{db.prepare("UPDATE payments SET status='cancelled' WHERE id=? AND status='authorized'").run(payment.id);db.prepare("UPDATE payment_authorization_attempts SET status='canceled' WHERE stripe_payment_intent_id=?").run(payment.stripe_payment_intent_id);})();
      throw new Error("PAYMENT_AUTHORIZATION_EXPIRED_OR_CANCELLED");
    }
    if(intent.status==="requires_capture" && intent.amount_capturable===money.clientAmountMinor){
      intent=await stripe.paymentIntents.capture(intentId,{}, {idempotencyKey:`nitido-capture-${jobId}`});
    }
    if(!matchesPayment(intent) || intent.status!=="succeeded" || intent.amount_received!==money.clientAmountMinor)throw new Error("PAYMENT_CAPTURE_NOT_CONFIRMED");
    chargeId=typeof intent.latest_charge==="string"?intent.latest_charge:intent.latest_charge?.id??null;
  }
  const captured=db.prepare("UPDATE payments SET status='captured',stripe_charge_id=COALESCE(?,stripe_charge_id) WHERE id=? AND status='authorized'").run(chargeId,payment.id);
  if(captured.changes===1)auditWorkflow(db,"PAYMENT_CAPTURED",jobId,firmId,null,{paymentId:payment.id});
  try{await initiateFirmTransfer(db,jobId);}
  catch(error){
    db.prepare("UPDATE payments SET transfer_status='failed' WHERE id=? AND stripe_transfer_id IS NULL").run(payment.id);
    auditWorkflow(db,"PAYMENT_TRANSFER_FAILED",jobId,firmId,null,{paymentId:payment.id,error:error instanceof Error?error.message:"unknown"});
  }
}

export async function initiateFirmTransfer(db:Database,jobId:string):Promise<TransferStatus>{
  ensurePaymentMoneySchema(db);
  const row=db.prepare(`SELECT p.id,p.status,p.refund_status,p.amount_gross,p.commission_amount,p.amount_net,p.currency,p.amount_gross_minor,p.commission_amount_minor,p.amount_net_minor,p.transfer_status,p.stripe_transfer_id,p.stripe_charge_id,j.status AS job_status,j.accepted_firm_id,f.stripe_account_id,f.stripe_account_status,f.stripe_transfers_capability,f.stripe_identity_country,f.stripe_default_currency FROM payments p JOIN jobs j ON j.id=p.job_id JOIN firms f ON f.id=j.accepted_firm_id WHERE p.job_id=?`).get(jobId) as Record<string,unknown>|undefined;
  if(!row||row.status!=="captured"||row.job_status!=="completed")throw new Error("TRANSFER_BLOCKED_JOB_NOT_COMPLETED");
  const money=moneyFromPayment(row);
  if(row.refund_status!=="none")throw new Error("TRANSFER_BLOCKED_REFUND");
  if(row.stripe_transfer_id||row.transfer_status==="processed")return "processed";
  if(!connectTransfersEnabled()){
    db.prepare("UPDATE payments SET transfer_status='blocked' WHERE id=? AND transfer_status='not_started'").run(row.id);
    return "blocked";
  }
  if(!row.stripe_account_id||row.stripe_account_status!=="ready"||row.stripe_transfers_capability!=="active"){
    db.prepare("UPDATE payments SET transfer_status='blocked' WHERE id=?").run(row.id);
    throw new Error("CONNECTED_ACCOUNT_NOT_READY");
  }
  if(money.currency==='EUR'){
    const contract=authorizationMoney(db,jobId,Number(row.amount_gross),0,false);
    if(contract.currency!==money.currency||contract.clientAmountMinor!==money.clientAmountMinor||contract.firmAmountMinor!==money.firmAmountMinor||contract.platformAmountMinor!==money.platformAmountMinor)throw Error('PAYMENT_DETAILS_MISMATCH');
    const raw=(db.prepare('SELECT pricing_snapshot FROM jobs WHERE id=?').get(jobId) as {pricing_snapshot:string|null}|undefined)?.pricing_snapshot;
    let country:unknown;try{country=JSON.parse(raw??'null')?.countryCode;}catch{throw Error('CONNECTED_ACCOUNT_CURRENCY_MISMATCH');}
    if(paymentCurrency(row.stripe_default_currency)!=='EUR'||serviceCountry(row.stripe_identity_country)==='RO'||row.stripe_identity_country!==country)throw Error('CONNECTED_ACCOUNT_CURRENCY_MISMATCH');
  }
  const stripe=getStripeClient();
  if(!stripe)throw new Error("STRIPE_NOT_CONFIGURED");
  const transfer=await stripe.transfers.create({amount:money.firmAmountMinor,currency:money.stripeCurrency,destination:String(row.stripe_account_id),...(row.stripe_charge_id?{source_transaction:String(row.stripe_charge_id)}:{}),metadata:{jobId,paymentId:String(row.id)}},{idempotencyKey:`nitido-transfer-${jobId}`});
  db.prepare("UPDATE payments SET transfer_status='processed',stripe_transfer_id=? WHERE id=? AND stripe_transfer_id IS NULL").run(transfer.id,row.id);
  auditWorkflow(db,"PAYMENT_TRANSFER_INITIATED",jobId,String(row.accepted_firm_id),null,{paymentId:row.id,transferId:transfer.id});
  return "processed";
}

export async function cancelPayment(db:Database,jobId:string):Promise<void>{
  requestPaymentCancellation(db,jobId);
  await reconcilePaymentCancellation(db,jobId,getStripeClient());
}

export type RefundStatus = "pending" | "succeeded" | "failed";

/** Apply only the full refund linked to this payment; never downgrade success on replay. */
export function applyStripeRefund(db:Database,paymentId:string,refund:Stripe.Refund):RefundStatus{
  ensurePaymentMoneySchema(db);
  const payment=db.prepare("SELECT * FROM payments WHERE id=?").get(paymentId) as Record<string,unknown>|undefined;
  const row=db.prepare("SELECT * FROM payment_refunds WHERE payment_id=?").get(paymentId) as Record<string,unknown>|undefined;
  const intentId=typeof refund.payment_intent==="string"?refund.payment_intent:refund.payment_intent?.id;
  const money=payment?moneyFromPayment(payment):null;
  if(!payment || !money || !row || !refundHasMoney(row,money) || (row.stripe_refund_id && row.stripe_refund_id!==refund.id) || intentId!==payment.stripe_payment_intent_id || refund.currency!==money.stripeCurrency || refund.amount!==money.clientAmountMinor)throw new Error("REFUND_DETAILS_MISMATCH");
  if(payment.refund_status==="succeeded")return "succeeded";
  if(payment.status!=="captured")throw new Error("PAYMENT_NOT_CAPTURED");
  const status:RefundStatus=refund.status==="succeeded"?"succeeded":["failed","canceled"].includes(refund.status??"")?"failed":"pending";
  db.transaction(()=>{
    db.prepare("UPDATE payment_refunds SET stripe_refund_id=?,status=? WHERE payment_id=?").run(refund.id,status,paymentId);
    db.prepare("UPDATE payments SET refund_status=?,status=CASE WHEN ?='succeeded' THEN 'refunded' ELSE status END WHERE id=?").run(status,status,paymentId);
  })();
  return status;
}

/** Full refunds only. Persist reversal and refund identity so retries reconcile rather than duplicate. */
export async function refundCapturedPayment(db:Database,jobId:string):Promise<RefundStatus>{
  ensurePaymentMoneySchema(db);
  const payment=db.prepare("SELECT * FROM payments WHERE job_id=?").get(jobId) as Record<string,unknown>|undefined;
  if(!payment)throw new Error("PAYMENT_NOT_CAPTURED");
  const money=moneyFromPayment(payment);
  if(payment.refund_status==="succeeded")return "succeeded";
  if(payment.status!=="captured")throw new Error("PAYMENT_NOT_CAPTURED");
  const stripe=getStripeClient();
  if(stripe&&!payment.stripe_payment_intent_id)throw new Error("STRIPE_PAYMENT_INTENT_MISSING");
  db.transaction(()=>{
    db.prepare("INSERT OR IGNORE INTO payment_refunds(id,payment_id,amount,status,currency,amount_minor) VALUES(?,?,?,'pending',?,?)").run(`refund_${payment.id}`,payment.id,payment.amount_gross,money.currency,money.clientAmountMinor);
    db.prepare("UPDATE payments SET refund_status='pending' WHERE id=? AND refund_status='none'").run(payment.id);
  })();
  const row=db.prepare("SELECT * FROM payment_refunds WHERE payment_id=?").get(payment.id) as Record<string,unknown>&{stripe_refund_id:string|null;stripe_reversal_id:string|null};
  if(!refundHasMoney(row,money))throw Error('REFUND_DETAILS_MISMATCH');
  if(stripe){
    if(row.stripe_refund_id)return applyStripeRefund(db,String(payment.id),await stripe.refunds.retrieve(row.stripe_refund_id));
    if(payment.stripe_transfer_id&&!row.stripe_reversal_id){
      const reversal=await stripe.transfers.createReversal(String(payment.stripe_transfer_id),{amount:money.firmAmountMinor},{idempotencyKey:`nitido-reversal-${jobId}`});
      db.transaction(()=>{
        db.prepare("UPDATE payment_refunds SET stripe_reversal_id=? WHERE payment_id=?").run(reversal.id,payment.id);
        db.prepare("UPDATE payments SET transfer_status='reversed' WHERE id=?").run(payment.id);
      })();
    }
    const refund=await stripe.refunds.create({payment_intent:String(payment.stripe_payment_intent_id)},{idempotencyKey:`nitido-refund-${jobId}`});
    return applyStripeRefund(db,String(payment.id),refund);
  }
  db.transaction(()=>{
    db.prepare("UPDATE payment_refunds SET status='succeeded' WHERE payment_id=?").run(payment.id);
    db.prepare("UPDATE payments SET status='refunded',refund_status='succeeded' WHERE id=?").run(payment.id);
  })();
  return "succeeded";
}

export function recordStripeEvent(db:Database,eventId:string,eventType:string):boolean{
  return db.prepare("INSERT OR IGNORE INTO stripe_events(event_id,event_type) VALUES(?,?)").run(eventId,eventType).changes===1;
}

export const COMMISSION_RATE=PLATFORM_COMMISSION;
