import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingEnabled, MarketingError } from '@/lib/adminMarketing';
import { marketingFailure } from '@/lib/adminMarketingAccess';
import { receiveMarketingWebhook } from '@/lib/adminMarketingDelivery';
export async function POST(req:NextRequest) {
  if(!marketingEnabled())return NextResponse.json({error:'Indisponibil.'},{status:404});
  try {const reader=req.body?.getReader();if(!reader)throw new MarketingError('Corp lipsă.');const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>64000){await reader.cancel();throw new MarketingError('Eveniment prea mare.',413);}chunks.push(value);}
    const headers=Object.fromEntries(['svix-id','svix-timestamp','svix-signature'].map(key=>[key,req.headers.get(key)??'']));return NextResponse.json(receiveMarketingWebhook(db,Buffer.concat(chunks).toString('utf8'),headers));
  }catch(error){return marketingFailure(error);}
}
