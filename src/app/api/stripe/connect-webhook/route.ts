import type Stripe from 'stripe';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getStripeClient} from '@/lib/payments';
import {processStripeEvent} from '@/lib/stripeEventProcessor';

export const runtime='nodejs';

/** Dedicated signing secret: Connect deliveries cannot impersonate platform events. */
export async function POST(req:NextRequest){
  const secret=process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  const mode=/^(?:sk|rk)_(test|live)_/.exec(process.env.STRIPE_SECRET_KEY??'')?.[1];
  if(!secret?.startsWith('whsec_')||secret===process.env.STRIPE_WEBHOOK_SECRET||!mode)
    return NextResponse.json({error:'Webhook Connect neconfigurat'},{status:503});
  let stripe:Stripe|null;
  try{stripe=getStripeClient();}catch{return NextResponse.json({error:'Webhook Connect neconfigurat'},{status:503});}
  if(!stripe)return NextResponse.json({error:'Webhook Connect neconfigurat'},{status:503});
  const signature=req.headers.get('stripe-signature');
  if(!signature)return NextResponse.json({error:'Semnătură lipsă'},{status:400});
  let event:Stripe.Event;
  try{event=stripe.webhooks.constructEvent(await req.text(),signature,secret);}
  catch{return NextResponse.json({error:'Semnătură invalidă'},{status:400});}
  if(!event||typeof event!=='object')
    return NextResponse.json({error:'Eveniment Connect necorespunzător'},{status:400});
  const object=event.data?.object as unknown as {id?:unknown}|undefined;
  if(typeof event.account!=='string'||!/^acct_[A-Za-z0-9]+$/.test(event.account)||
     event.livemode!==(mode==='live')||typeof event.id!=='string'||!event.id.startsWith('evt_')||
     !['account.updated','payout.paid','payout.failed'].includes(event.type)||
     !object||typeof object.id!=='string'||
     (event.type==='account.updated'?object.id!==event.account:!/^po_[A-Za-z0-9]+$/.test(object.id)))
    return NextResponse.json({error:'Eveniment Connect necorespunzător'},{status:400});
  try{return NextResponse.json(await processStripeEvent(db,stripe,event));}
  catch{return NextResponse.json({error:'Sincronizarea Connect a eșuat. Notificarea poate fi retrimisă.'},{status:500});}
}
