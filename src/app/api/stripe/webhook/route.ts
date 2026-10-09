import Stripe from "stripe";
import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {getStripeClient} from "@/lib/payments";
import {processStripeEvent} from "@/lib/stripeEventProcessor";

export const runtime="nodejs";

export async function POST(req:NextRequest){
  let stripe:Stripe|null;
  try{stripe=getStripeClient();}catch{return NextResponse.json({error:"Webhook Stripe neconfigurat"},{status:503});}
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret||!stripe)return NextResponse.json({error:"Webhook Stripe neconfigurat"},{status:503});
  const signature=req.headers.get("stripe-signature");if(!signature)return NextResponse.json({error:"Semnătură lipsă"},{status:400});
  let event:Stripe.Event;
  try{event=stripe.webhooks.constructEvent(await req.text(),signature,secret);}catch{return NextResponse.json({error:"Semnătură invalidă"},{status:400});}
  try{return NextResponse.json(await processStripeEvent(db,stripe,event));}
  catch{return NextResponse.json({error:"Sincronizarea Stripe a eșuat. Notificarea poate fi retrimisă."},{status:500});}
}
