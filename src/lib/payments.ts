import type { Database } from "better-sqlite3";
import Stripe from "stripe";
import { newId } from "@/lib/db";
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
  const existing = db.prepare("SELECT id FROM payments WHERE job_id=?").get(jobId) as {id:string}|undefined;
  if (existing) return existing.id;
  const {clientAmount,firmAmount,platformAmount}=calculatePaymentSplit(grossAmount,discountAmount);
  const id=newId("pay");
  const stripe=getStripeClient();
  let intentId:string|null=null;
  if(stripe){
    const intent=await stripe.paymentIntents.create({amount:clientAmount*100,currency:"ron",capture_method:"manual",metadata:{jobId,paymentId:id,pricingSource:"server"}},{idempotencyKey:`nitido-authorize-${jobId}`});
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
  if(stripe&&payment.stripe_payment_intent_id){
    const intent=await stripe.paymentIntents.capture(String(payment.stripe_payment_intent_id),{}, {idempotencyKey:`nitido-capture-${jobId}`});
    chargeId=typeof intent.latest_charge==="string"?intent.latest_charge:null;
  }
  db.prepare("UPDATE payments SET status='captured',stripe_charge_id=COALESCE(?,stripe_charge_id) WHERE id=? AND status='authorized'").run(chargeId,payment.id);
  auditWorkflow(db,"PAYMENT_CAPTURED",jobId,firmId,null,{paymentId:payment.id});
  try{await initiateFirmTransfer(db,jobId);}
  catch(error){
    db.prepare("UPDATE payments SET transfer_status='failed' WHERE id=? AND stripe_transfer_id IS NULL").run(payment.id);
    auditWorkflow(db,"PAYMENT_TRANSFER_FAILED",jobId,firmId,null,{paymentId:payment.id,error:error instanceof Error?error.message:"unknown"});
  }
}

export async function initiateFirmTransfer(db:Database,jobId:string):Promise<TransferStatus>{
  const row=db.prepare(`SELECT p.id,p.status,p.amount_net,p.transfer_status,p.stripe_transfer_id,p.stripe_charge_id,j.status AS job_status,j.accepted_firm_id,f.stripe_account_id,f.stripe_account_status,f.stripe_transfers_capability FROM payments p JOIN jobs j ON j.id=p.job_id JOIN firms f ON f.id=j.accepted_firm_id WHERE p.job_id=?`).get(jobId) as Record<string,unknown>|undefined;
  if(!row||row.status!=="captured"||row.job_status!=="completed")throw new Error("TRANSFER_BLOCKED_JOB_NOT_COMPLETED");
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
  if(stripe&&payment.stripe_payment_intent_id)await stripe.paymentIntents.cancel(String(payment.stripe_payment_intent_id),{}, {idempotencyKey:`nitido-cancel-${jobId}`});
  db.prepare("UPDATE payments SET status='cancelled' WHERE id=? AND status='authorized'").run(payment.id);
}

/** V1 supports full refunds. Reverse an existing firm transfer before refunding the platform charge. */
export async function refundCapturedPayment(db:Database,jobId:string):Promise<void>{
  const payment=db.prepare("SELECT * FROM payments WHERE job_id=?").get(jobId) as Record<string,unknown>|undefined;
  if(!payment)throw new Error("PAYMENT_NOT_CAPTURED");
  if(payment.refund_status==="succeeded")return;
  if(payment.status!=="captured")throw new Error("PAYMENT_NOT_CAPTURED");
  const stripe=getStripeClient();
  let reversalId:string|null=null,refundId:string|null=null;
  if(stripe){
    if(payment.stripe_transfer_id){const reversal=await stripe.transfers.createReversal(String(payment.stripe_transfer_id),{amount:Number(payment.amount_net)*100},{idempotencyKey:`nitido-reversal-${jobId}`});reversalId=reversal.id;}
    if(!payment.stripe_payment_intent_id)throw new Error("STRIPE_PAYMENT_INTENT_MISSING");
    const refund=await stripe.refunds.create({payment_intent:String(payment.stripe_payment_intent_id)},{idempotencyKey:`nitido-refund-${jobId}`});refundId=refund.id;
  }
  db.transaction(()=>{
    db.prepare("INSERT OR IGNORE INTO payment_refunds(id,payment_id,amount,stripe_refund_id,stripe_reversal_id,status) VALUES(?,?,?,?,?,'succeeded')").run(`refund_${payment.id}`,payment.id,payment.amount_gross,refundId,reversalId);
    db.prepare("UPDATE payments SET status='refunded',refund_status='succeeded',transfer_status=CASE WHEN stripe_transfer_id IS NULL THEN transfer_status ELSE 'reversed' END WHERE id=?").run(payment.id);
  })();
}

export function recordStripeEvent(db:Database,eventId:string,eventType:string):boolean{
  return db.prepare("INSERT OR IGNORE INTO stripe_events(event_id,event_type) VALUES(?,?)").run(eventId,eventType).changes===1;
}

export const COMMISSION_RATE=PLATFORM_COMMISSION;
