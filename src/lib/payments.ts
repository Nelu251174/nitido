import type { Database } from "better-sqlite3";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { calcNetForFirm, PLATFORM_COMMISSION } from "@/lib/pricing";
import { assertCompletionProof, auditWorkflow } from "@/lib/proofOfWork";

export type TransferStatus = "not_started" | "blocked" | "pending" | "processed" | "failed" | "reversed";

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("STRIPE_SECRET_KEY lipsește în production");
    return null;
  }
  return new Stripe(key);
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
export async function authorizePayment(db: Database, jobId: string, grossAmount: number, _firmAccountId?: string | null, discountAmount = 0): Promise<string> {
  const existing = db.prepare("SELECT id,status FROM payments WHERE job_id=?").get(jobId) as {id:string;status:string}|undefined;
  if (existing) {
    if (existing.status !== "authorized") throw new Error("PAYMENT_NOT_AUTHORIZED");
    return existing.id;
  }
  const {clientAmount,firmAmount,platformAmount}=calculatePaymentSplit(grossAmount,discountAmount);
  // Stable metadata across retries after an uncertain provider response.
  const id=`pay_${createHash("sha256").update(jobId).digest("hex")}`;
  const stripe=getStripeClient();
  let intentId:string|null=null;
  if(stripe){
    // HOLD pe cardul salvat al clientului (card pe fișier — vezi clientPayments.ts).
    // off_session + confirm = autorizare imediată fără ca clientul să fie prezent;
    // capture_method:manual = doar rezervare, se încasează abia la finalizare.
    const client=db.prepare("SELECT u.stripe_customer_id AS customerId, u.stripe_payment_method_id AS paymentMethodId FROM jobs j JOIN users u ON u.id=j.client_id WHERE j.id=?").get(jobId) as {customerId:string|null;paymentMethodId:string|null}|undefined;
    if(!client?.customerId||!client?.paymentMethodId){
      throw new Error("Clientul nu are un card salvat pentru această lucrare");
    }
    const intent=await stripe.paymentIntents.create({
      amount:clientAmount*100,
      currency:"ron",
      customer:client.customerId,
      payment_method:client.paymentMethodId,
      off_session:true,
      confirm:true,
      capture_method:"manual",
      metadata:{jobId,paymentId:id,pricingSource:"server"},
    },{idempotencyKey:`nitido-authorize-${jobId}`});
    if(intent.status!=="requires_capture" || intent.currency!=="ron" || intent.amount!==clientAmount*100 || intent.amount_capturable!==clientAmount*100) throw new Error("PAYMENT_AUTHORIZATION_NOT_CONFIRMED");
    intentId=intent.id;
  }
  db.prepare(`INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status,stripe_payment_intent_id) VALUES(?,?,?,?,?,'authorized',?)`).run(id,jobId,clientAmount,platformAmount,firmAmount,intentId);
  return id;
}

/** Capture once, then initiate one server-derived transfer only when Connect is explicitly enabled and ready. */
export async function capturePayment(db:Database,jobId:string):Promise<void>{
  const {firmId}=assertCompletionProof(db,jobId);
  const payment=db.prepare("SELECT * FROM payments WHERE job_id=?").get(jobId) as Record<string,unknown>|undefined;
  if(!payment)throw new Error("PAYMENT_NOT_AUTHORIZED");
  if(payment.status==="captured")return;
  if(payment.status!=="authorized")throw new Error("PAYMENT_NOT_AUTHORIZED");
  const stripe=getStripeClient();
  let chargeId:string|null=(payment.stripe_charge_id as string|null)??null;
  if(stripe){
    if(!payment.stripe_payment_intent_id)throw new Error("STRIPE_PAYMENT_INTENT_MISSING");
    const intentId=String(payment.stripe_payment_intent_id);
    let intent=await stripe.paymentIntents.retrieve(intentId);
    const matchesPayment=(value:Stripe.PaymentIntent)=>value.id===intentId && value.currency==="ron" && value.amount===Number(payment.amount_gross)*100 && value.metadata.jobId===jobId && value.metadata.paymentId===payment.id;
    if(!matchesPayment(intent))throw new Error("PAYMENT_DETAILS_MISMATCH");
    if(intent.status==="requires_capture" && intent.amount_capturable===Number(payment.amount_gross)*100){
      intent=await stripe.paymentIntents.capture(intentId,{}, {idempotencyKey:`nitido-capture-${jobId}`});
    }
    if(!matchesPayment(intent) || intent.status!=="succeeded" || intent.amount_received!==Number(payment.amount_gross)*100)throw new Error("PAYMENT_CAPTURE_NOT_CONFIRMED");
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
  const row=db.prepare(`SELECT p.id,p.status,p.refund_status,p.amount_net,p.transfer_status,p.stripe_transfer_id,p.stripe_charge_id,j.status AS job_status,j.accepted_firm_id,f.stripe_account_id,f.stripe_account_status,f.stripe_transfers_capability FROM payments p JOIN jobs j ON j.id=p.job_id JOIN firms f ON f.id=j.accepted_firm_id WHERE p.job_id=?`).get(jobId) as Record<string,unknown>|undefined;
  if(!row||row.status!=="captured"||row.job_status!=="completed")throw new Error("TRANSFER_BLOCKED_JOB_NOT_COMPLETED");
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
  const stripe=getStripeClient();
  if(!stripe)throw new Error("STRIPE_NOT_CONFIGURED");
  const transfer=await stripe.transfers.create({amount:Number(row.amount_net)*100,currency:"ron",destination:String(row.stripe_account_id),...(row.stripe_charge_id?{source_transaction:String(row.stripe_charge_id)}:{}),metadata:{jobId,paymentId:String(row.id)}},{idempotencyKey:`nitido-transfer-${jobId}`});
  db.prepare("UPDATE payments SET transfer_status='processed',stripe_transfer_id=? WHERE id=? AND stripe_transfer_id IS NULL").run(transfer.id,row.id);
  auditWorkflow(db,"PAYMENT_TRANSFER_INITIATED",jobId,String(row.accepted_firm_id),null,{paymentId:row.id,transferId:transfer.id});
  return "processed";
}

export async function cancelPayment(db:Database,jobId:string):Promise<void>{
  const payment=db.prepare("SELECT * FROM payments WHERE job_id=? AND status='authorized'").get(jobId) as Record<string,unknown>|undefined;
  if(!payment)return;
  const stripe=getStripeClient();
  if(stripe){
    if(!payment.stripe_payment_intent_id)throw new Error("STRIPE_PAYMENT_INTENT_MISSING");
    const intent=await stripe.paymentIntents.cancel(String(payment.stripe_payment_intent_id),{}, {idempotencyKey:`nitido-cancel-${jobId}`});
    if(intent.status!=="canceled")throw new Error("PAYMENT_CANCELLATION_NOT_CONFIRMED");
  }
  db.prepare("UPDATE payments SET status='cancelled' WHERE id=? AND status='authorized'").run(payment.id);
}

export type RefundStatus = "pending" | "succeeded" | "failed";

/** Apply only the full refund linked to this payment; never downgrade success on replay. */
export function applyStripeRefund(db:Database,paymentId:string,refund:Stripe.Refund):RefundStatus{
  const payment=db.prepare("SELECT * FROM payments WHERE id=?").get(paymentId) as Record<string,unknown>|undefined;
  const row=db.prepare("SELECT stripe_refund_id FROM payment_refunds WHERE payment_id=?").get(paymentId) as {stripe_refund_id:string|null}|undefined;
  const intentId=typeof refund.payment_intent==="string"?refund.payment_intent:refund.payment_intent?.id;
  if(!payment || !row || (row.stripe_refund_id && row.stripe_refund_id!==refund.id) || intentId!==payment.stripe_payment_intent_id || refund.currency!=="ron" || refund.amount!==Number(payment.amount_gross)*100)throw new Error("REFUND_DETAILS_MISMATCH");
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
  const payment=db.prepare("SELECT * FROM payments WHERE job_id=?").get(jobId) as Record<string,unknown>|undefined;
  if(!payment)throw new Error("PAYMENT_NOT_CAPTURED");
  if(payment.refund_status==="succeeded")return "succeeded";
  if(payment.status!=="captured")throw new Error("PAYMENT_NOT_CAPTURED");
  const stripe=getStripeClient();
  if(stripe&&!payment.stripe_payment_intent_id)throw new Error("STRIPE_PAYMENT_INTENT_MISSING");
  db.transaction(()=>{
    db.prepare("INSERT OR IGNORE INTO payment_refunds(id,payment_id,amount,status) VALUES(?,?,?,'pending')").run(`refund_${payment.id}`,payment.id,payment.amount_gross);
    db.prepare("UPDATE payments SET refund_status='pending' WHERE id=? AND refund_status='none'").run(payment.id);
  })();
  const row=db.prepare("SELECT stripe_refund_id,stripe_reversal_id FROM payment_refunds WHERE payment_id=?").get(payment.id) as {stripe_refund_id:string|null;stripe_reversal_id:string|null};
  if(stripe){
    if(row.stripe_refund_id)return applyStripeRefund(db,String(payment.id),await stripe.refunds.retrieve(row.stripe_refund_id));
    if(payment.stripe_transfer_id&&!row.stripe_reversal_id){
      const reversal=await stripe.transfers.createReversal(String(payment.stripe_transfer_id),{amount:Number(payment.amount_net)*100},{idempotencyKey:`nitido-reversal-${jobId}`});
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
