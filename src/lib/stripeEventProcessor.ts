import type Stripe from 'stripe';
import type {Database} from 'better-sqlite3';
import {applyStripeRefund,recordStripeEvent} from './payments';
import {readRecipientCapability} from './stripeConnect';
import {receiveStripeEvent,markStripeInbox,stripeResourceFence} from './stripeInbox';
import {ensurePaymentMoneySchema,moneyFromPayment,moneyFromAuthorizationRequest} from './paymentMoney';

const objectId=(value:unknown):string|undefined=>typeof value==='string'?value:value&&typeof value==='object'&&'id' in value&&typeof value.id==='string'?value.id:undefined;

/** Caller must verify the webhook signature or retrieve the exact event from Stripe. */
export async function processStripeEvent(db:Database,stripe:Stripe,event:Stripe.Event,options:{beforeCommit?:()=>void}={}){
  ensurePaymentMoneySchema(db);
  const previous=db.prepare('SELECT status FROM stripe_webhook_inbox WHERE event_id=?').get(event.id) as {status:string}|undefined;
  receiveStripeEvent(db,event);
  if(db.prepare("SELECT 1 FROM stripe_events WHERE event_id=?").get(event.id)&&(!previous||['processed','ignored'].includes(previous.status))){
    markStripeInbox(db,event.id,'processed');return {received:true,duplicate:true};
  }
  db.prepare('UPDATE stripe_webhook_inbox SET attempts=attempts+1 WHERE event_id=?').run(event.id);
  const object=event.data.object as unknown as Record<string,unknown>;
  // External reads finish before the synchronous transaction. A failed read is never acknowledged as processed.
  const updates:(()=>void)[]=[];
  const fence=stripeResourceFence(db);
  try{
    // Platform charges/refunds/transfers must not be mutated by a connected-account event.
    if(!event.account){
      if(event.type==="payment_intent.canceled"&&typeof object.id==="string"&&(db.prepare('SELECT 1 FROM payments WHERE stripe_payment_intent_id=?').get(object.id)||db.prepare('SELECT 1 FROM payment_authorization_attempts WHERE stripe_payment_intent_id=?').get(object.id))){
        const intentId=object.id;
        const payment=db.prepare('SELECT * FROM payments WHERE stripe_payment_intent_id=?').get(intentId) as Record<string,unknown>|undefined;
        const money=payment?moneyFromPayment(payment):null;
        const attempt=!payment?db.prepare('SELECT request_json FROM payment_authorization_attempts WHERE stripe_payment_intent_id=?').get(intentId) as {request_json:string}|undefined:undefined;
        const requestMoney=attempt?moneyFromAuthorizationRequest(JSON.parse(attempt.request_json)):null;
        const currency=money?.stripeCurrency??requestMoney?.stripeCurrency,amount=money?.clientAmountMinor??requestMoney?.amountMinor;
        if((currency==='eur'||object.currency!==undefined)&&object.currency!==currency||(currency==='eur'||object.amount!==undefined)&&object.amount!==amount)throw Error('PAYMENT_DETAILS_MISMATCH');
        fence.watch(`intent:${intentId}`);
        updates.push(()=>{
          db.prepare("UPDATE payments SET status='cancelled' WHERE stripe_payment_intent_id=? AND status='authorized'").run(intentId);
          db.prepare("UPDATE payment_authorization_attempts SET status='canceled' WHERE stripe_payment_intent_id=?").run(intentId);
        });
      }
      if(event.type==="charge.succeeded"){
        const intentId=objectId(object.payment_intent),balanceId=objectId(object.balance_transaction),chargeId=objectId(object.id);
        const payment=intentId?db.prepare("SELECT * FROM payments WHERE stripe_payment_intent_id=?").get(intentId) as Record<string,unknown>|undefined:undefined;
        if(payment&&balanceId&&chargeId){
          const money=moneyFromPayment(payment);
          if((money.currency==='EUR'||object.currency!==undefined)&&object.currency!==money.stripeCurrency||(money.currency==='EUR'||object.amount!==undefined)&&object.amount!==money.clientAmountMinor)throw Error('CHARGE_DETAILS_MISMATCH');
          fence.watch(`intent:${intentId}`);
          const balance=await stripe.balanceTransactions.retrieve(balanceId);
          // The balance transaction is denominated in settlement currency, which can
          // differ from the original RON charge on the Spanish EUR account.
          if(!['ron','eur'].includes(balance.currency)||objectId(balance.source)!==chargeId||!Number.isSafeInteger(balance.fee)||balance.fee<0)throw Error("BALANCE_DETAILS_MISMATCH");
          if(balance.amount!==undefined&&(!Number.isSafeInteger(balance.amount)||balance.amount<balance.fee))throw Error('BALANCE_DETAILS_MISMATCH');
          updates.push(()=>{db.prepare("UPDATE payments SET stripe_fee_amount=?,stripe_fee_currency=? WHERE id=? AND stripe_payment_intent_id=?").run(balance.fee,balance.currency.toUpperCase(),payment.id,intentId);});
        }
      }
      if(["refund.created","refund.updated","refund.failed","charge.refunded"].includes(event.type)){
        const rows=event.type==="charge.refunded"
          ?db.prepare("SELECT r.payment_id,r.stripe_refund_id,p.stripe_payment_intent_id FROM payment_refunds r JOIN payments p ON p.id=r.payment_id WHERE p.stripe_payment_intent_id=? AND r.stripe_refund_id IS NOT NULL").all(objectId(object.payment_intent)??"")
          :db.prepare("SELECT r.payment_id,r.stripe_refund_id,p.stripe_payment_intent_id FROM payment_refunds r JOIN payments p ON p.id=r.payment_id WHERE r.stripe_refund_id=?").all(objectId(object.id)??"");
        for(const row of rows as {payment_id:string;stripe_refund_id:string;stripe_payment_intent_id:string}[]){
          fence.watch(`intent:${row.stripe_payment_intent_id}`);
          const refund=await stripe.refunds.retrieve(row.stripe_refund_id);
          updates.push(()=>{applyStripeRefund(db,row.payment_id,refund);});
        }
      }
      if(event.type==="charge.dispute.created"||event.type==="charge.dispute.closed"){
        const chargeId=objectId(object.charge);
        const payment=chargeId?db.prepare("SELECT id,stripe_payment_intent_id FROM payments WHERE stripe_charge_id=?").get(chargeId) as {id:string;stripe_payment_intent_id:string}|undefined:undefined;
        if(payment&&typeof object.id==="string"){
          fence.watch(`intent:${payment.stripe_payment_intent_id}`);
          const dispute=await stripe.disputes.retrieve(object.id);
          if(dispute.id!==object.id||objectId(dispute.charge)!==chargeId)throw Error("DISPUTE_DETAILS_MISMATCH");
          updates.push(()=>{db.prepare("UPDATE payments SET dispute_status=? WHERE id=? AND stripe_charge_id=?").run(dispute.status,payment.id,chargeId);});
        }
      }
      if((event.type==="transfer.updated"||event.type==="transfer.reversed")&&object.reversed===true&&db.prepare('SELECT 1 FROM payments WHERE stripe_transfer_id=?').get(objectId(object.id)??'')){
        const payment=db.prepare('SELECT * FROM payments WHERE stripe_transfer_id=?').get(objectId(object.id)) as Record<string,unknown>;
        const money=moneyFromPayment(payment);
        if((money.currency==='EUR'||object.currency!==undefined)&&object.currency!==money.stripeCurrency||(money.currency==='EUR'||object.amount!==undefined)&&object.amount!==money.firmAmountMinor||(money.currency==='EUR'||object.amount_reversed!==undefined)&&object.amount_reversed!==money.firmAmountMinor)throw Error('TRANSFER_DETAILS_MISMATCH');
        fence.watch(`intent:${payment.stripe_payment_intent_id}`);
        updates.push(()=>{db.prepare("UPDATE payments SET transfer_status='reversed' WHERE stripe_transfer_id=?").run(objectId(object.id)??"");});
      }
      // A failed authorization is not a failed firm transfer. Its event remains available for reconciliation.
    }
    if((event.type==="payout.paid"||event.type==="payout.failed")&&event.account&&typeof object.id==="string"){
      const accountId=event.account;
      if(db.prepare("SELECT 1 FROM firms WHERE stripe_account_id=?").get(accountId)){
        fence.watch(`payout:${accountId}:${object.id}`);
        const payout=await stripe.payouts.retrieve(object.id,{}, {stripeAccount:accountId});
        if(payout.id!==object.id||!Number.isSafeInteger(payout.amount))throw Error("PAYOUT_DETAILS_MISMATCH");
        updates.push(()=>{db.prepare(`INSERT INTO stripe_bank_payouts(account_id,payout_id,amount_minor,currency,status,arrival_date) VALUES(?,?,?,?,?,?)
          ON CONFLICT(account_id,payout_id) DO UPDATE SET amount_minor=excluded.amount_minor,currency=excluded.currency,status=excluded.status,arrival_date=excluded.arrival_date,updated_at=datetime('now')`)
          .run(accountId,payout.id,payout.amount,payout.currency,payout.status,payout.arrival_date);});
      }
    }
    if(event.type==="account.updated"&&typeof object.id==="string"&&(!event.account||event.account===object.id)&&db.prepare("SELECT 1 FROM firms WHERE stripe_account_id=?").get(object.id)){
      const accountId=object.id;
      fence.watch(`account:${accountId}`);
      const {status,capability}=await readRecipientCapability(accountId,stripe);
      updates.push(()=>{db.prepare("UPDATE firms SET stripe_account_status=?,stripe_transfers_capability=? WHERE stripe_account_id=?").run(status,capability,accountId);});
    }
    const applied=db.transaction(()=>{
      const recorded=recordStripeEvent(db,event.id,event.type);
      const needsReview=db.prepare("SELECT 1 FROM stripe_webhook_inbox WHERE event_id=? AND status IN ('received','needs_review','failed')").get(event.id);
      if(!recorded&&!needsReview)return false;
      options.beforeCommit?.();
      fence.commit();
      for(const update of updates)update();
      const supported=['payment_intent.canceled','charge.succeeded','refund.created','refund.updated','refund.failed','charge.refunded','charge.dispute.created','charge.dispute.closed','transfer.updated','transfer.reversed','payout.paid','payout.failed','account.updated'].includes(event.type);
      markStripeInbox(db,event.id,updates.length?'processed':supported?'needs_review':'ignored');
      return true;
    })();
    return {received:true,...(!applied?{duplicate:true}:{})};
  }catch(error){
    try{markStripeInbox(db,event.id,'failed');}catch{/* Stripe retries the non-2xx response. */}
    throw error;
  }
}
