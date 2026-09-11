import Stripe from "stripe";
import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {applyStripeRefund,getStripeClient,recordStripeEvent} from "@/lib/payments";
import {readRecipientCapability} from "@/lib/stripeConnect";

export const runtime="nodejs";
const objectId=(value:unknown):string|undefined=>typeof value==="string"?value:value&&typeof value==="object"&&"id" in value&&typeof value.id==="string"?value.id:undefined;

export async function POST(req:NextRequest){
  let stripe:Stripe|null;
  try{stripe=getStripeClient();}catch{return NextResponse.json({error:"Webhook Stripe neconfigurat"},{status:503});}
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret||!stripe)return NextResponse.json({error:"Webhook Stripe neconfigurat"},{status:503});
  const signature=req.headers.get("stripe-signature");if(!signature)return NextResponse.json({error:"Semnătură lipsă"},{status:400});
  let event:Stripe.Event;
  try{event=stripe.webhooks.constructEvent(await req.text(),signature,secret);}catch{return NextResponse.json({error:"Semnătură invalidă"},{status:400});}
  if(db.prepare("SELECT 1 FROM stripe_events WHERE event_id=?").get(event.id))return NextResponse.json({received:true,duplicate:true});
  const object=event.data.object as unknown as Record<string,unknown>;
  // External reads finish before the synchronous transaction. A failed read is never acknowledged as processed.
  const updates:(()=>void)[]=[];
  try{
    // Platform charges/refunds/transfers must not be mutated by a connected-account event.
    if(!event.account){
      if(event.type==="charge.succeeded"){
        const intentId=objectId(object.payment_intent),balanceId=objectId(object.balance_transaction),chargeId=objectId(object.id);
        const payment=intentId?db.prepare("SELECT id FROM payments WHERE stripe_payment_intent_id=?").get(intentId) as {id:string}|undefined:undefined;
        if(payment&&balanceId&&chargeId){
          const balance=await stripe.balanceTransactions.retrieve(balanceId);
          if(balance.currency!=="ron"||objectId(balance.source)!==chargeId||!Number.isSafeInteger(balance.fee))throw Error("BALANCE_DETAILS_MISMATCH");
          updates.push(()=>{db.prepare("UPDATE payments SET stripe_fee_amount=? WHERE id=? AND stripe_payment_intent_id=?").run(balance.fee,payment.id,intentId);});
        }
      }
      if(["refund.created","refund.updated","refund.failed","charge.refunded"].includes(event.type)){
        const rows=event.type==="charge.refunded"
          ?db.prepare("SELECT r.payment_id,r.stripe_refund_id FROM payment_refunds r JOIN payments p ON p.id=r.payment_id WHERE p.stripe_payment_intent_id=? AND r.stripe_refund_id IS NOT NULL").all(objectId(object.payment_intent)??"")
          :db.prepare("SELECT payment_id,stripe_refund_id FROM payment_refunds WHERE stripe_refund_id=?").all(objectId(object.id)??"");
        for(const row of rows as {payment_id:string;stripe_refund_id:string}[]){
          const refund=await stripe.refunds.retrieve(row.stripe_refund_id);
          updates.push(()=>{applyStripeRefund(db,row.payment_id,refund);});
        }
      }
      if(event.type==="charge.dispute.created"||event.type==="charge.dispute.closed"){
        const chargeId=objectId(object.charge);
        const payment=chargeId?db.prepare("SELECT id FROM payments WHERE stripe_charge_id=?").get(chargeId) as {id:string}|undefined:undefined;
        if(payment&&typeof object.id==="string"){
          const dispute=await stripe.disputes.retrieve(object.id);
          if(objectId(dispute.charge)!==chargeId)throw Error("DISPUTE_DETAILS_MISMATCH");
          updates.push(()=>{db.prepare("UPDATE payments SET dispute_status=? WHERE id=? AND stripe_charge_id=?").run(dispute.status,payment.id,chargeId);});
        }
      }
      if((event.type==="transfer.updated"||event.type==="transfer.reversed")&&object.reversed===true){
        updates.push(()=>{db.prepare("UPDATE payments SET transfer_status='reversed' WHERE stripe_transfer_id=?").run(objectId(object.id)??"");});
      }
      // A failed authorization is not a failed firm transfer. Its event remains available for reconciliation.
    }
    if((event.type==="payout.paid"||event.type==="payout.failed")&&event.account&&typeof object.id==="string"){
      const accountId=event.account;
      if(db.prepare("SELECT 1 FROM firms WHERE stripe_account_id=?").get(accountId)){
        const payout=await stripe.payouts.retrieve(object.id,{}, {stripeAccount:accountId});
        if(payout.id!==object.id||!Number.isSafeInteger(payout.amount))throw Error("PAYOUT_DETAILS_MISMATCH");
        updates.push(()=>{db.prepare(`INSERT INTO stripe_bank_payouts(account_id,payout_id,amount_minor,currency,status,arrival_date) VALUES(?,?,?,?,?,?)
          ON CONFLICT(account_id,payout_id) DO UPDATE SET amount_minor=excluded.amount_minor,currency=excluded.currency,status=excluded.status,arrival_date=excluded.arrival_date,updated_at=datetime('now')`)
          .run(accountId,payout.id,payout.amount,payout.currency,payout.status,payout.arrival_date);});
      }
    }
    if(event.type==="account.updated"&&typeof object.id==="string"&&(!event.account||event.account===object.id)&&db.prepare("SELECT 1 FROM firms WHERE stripe_account_id=?").get(object.id)){
      const accountId=object.id,{status,capability}=await readRecipientCapability(accountId);
      updates.push(()=>{db.prepare("UPDATE firms SET stripe_account_status=?,stripe_transfers_capability=? WHERE stripe_account_id=?").run(status,capability,accountId);});
    }
    const applied=db.transaction(()=>{
      if(!recordStripeEvent(db,event.id,event.type))return false;
      for(const update of updates)update();
      return true;
    })();
    return NextResponse.json({received:true,...(!applied?{duplicate:true}:{})});
  }catch{
    return NextResponse.json({error:"Sincronizarea Stripe a eșuat. Notificarea poate fi retrimisă."},{status:500});
  }
}
