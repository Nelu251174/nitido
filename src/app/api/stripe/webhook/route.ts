import Stripe from "stripe";
import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {applyStripeRefund,getStripeClient,recordStripeEvent} from "@/lib/payments";
import {refreshRecipientCapability} from "@/lib/stripeConnect";

export const runtime="nodejs";

export async function POST(req:NextRequest){
  const secret=process.env.STRIPE_WEBHOOK_SECRET;const stripe=getStripeClient();
  if(!secret||!stripe)return NextResponse.json({error:"Webhook Stripe neconfigurat"},{status:503});
  const signature=req.headers.get("stripe-signature");if(!signature)return NextResponse.json({error:"Semnătură lipsă"},{status:400});
  let event:Stripe.Event;
  try{event=stripe.webhooks.constructEvent(await req.text(),signature,secret);}catch{return NextResponse.json({error:"Semnătură invalidă"},{status:400});}
  if(!recordStripeEvent(db,event.id,event.type))return NextResponse.json({received:true,duplicate:true});
  const object=event.data.object as unknown as Record<string,unknown>;
  const metadata=(object.metadata??{}) as Record<string,string>;
  const paymentId=metadata.paymentId;
  if(event.type==="payment_intent.payment_failed"&&paymentId)db.prepare("UPDATE payments SET transfer_status='failed' WHERE id=?").run(paymentId);
  if(event.type==="charge.succeeded"&&paymentId&&typeof object.balance_transaction==="string"){
    const balance=await stripe.balanceTransactions.retrieve(object.balance_transaction);
    db.prepare("UPDATE payments SET stripe_fee_amount=? WHERE id=?").run(balance.fee,paymentId);
  }
  if(["refund.created","refund.updated","refund.failed","charge.refunded"].includes(event.type)){
    const rows=event.type==="charge.refunded"
      ?db.prepare("SELECT r.payment_id,r.stripe_refund_id FROM payment_refunds r JOIN payments p ON p.id=r.payment_id WHERE p.stripe_payment_intent_id=? AND r.stripe_refund_id IS NOT NULL").all(typeof object.payment_intent==="string"?object.payment_intent:"")
      :db.prepare("SELECT payment_id,stripe_refund_id FROM payment_refunds WHERE stripe_refund_id=?").all(typeof object.id==="string"?object.id:"");
    try{
      for(const row of rows as {payment_id:string;stripe_refund_id:string}[])applyStripeRefund(db,row.payment_id,await stripe.refunds.retrieve(row.stripe_refund_id));
    }catch{db.prepare("DELETE FROM stripe_events WHERE event_id=?").run(event.id);return NextResponse.json({error:"Sincronizarea rambursării a eșuat"},{status:500});}
  }
  if(event.type==="charge.dispute.created"&&paymentId)db.prepare("UPDATE payments SET dispute_status='open' WHERE id=?").run(paymentId);
  if(event.type==="charge.dispute.closed"&&paymentId)db.prepare("UPDATE payments SET dispute_status=? WHERE id=?").run(String(object.status??"closed"),paymentId);
  if(event.type==="transfer.updated"&&paymentId&&object.reversed===true)db.prepare("UPDATE payments SET transfer_status='reversed' WHERE id=?").run(paymentId);
  if(event.type==="transfer.reversed"&&paymentId)db.prepare("UPDATE payments SET transfer_status='reversed' WHERE id=?").run(paymentId);
  if(event.type==="payout.paid"||event.type==="payout.failed"){
    const account=event.account;if(account)db.prepare("UPDATE payments SET payout_status=? WHERE stripe_transfer_id IS NOT NULL AND job_id IN (SELECT j.id FROM jobs j JOIN firms f ON f.id=j.accepted_firm_id WHERE f.stripe_account_id=?)").run(event.type==="payout.paid"?"paid":"failed",account);
  }
  if(event.type==="account.updated"&&typeof object.id==="string"){
    try{await refreshRecipientCapability(db,object.id);}catch{db.prepare("DELETE FROM stripe_events WHERE event_id=?").run(event.id);return NextResponse.json({error:"Sincronizarea contului a eșuat"},{status:500});}
  }
  return NextResponse.json({received:true});
}
