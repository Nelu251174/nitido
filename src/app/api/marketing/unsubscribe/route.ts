import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingEnabled, MarketingError } from '@/lib/adminMarketing';
import { marketingBody, marketingFailure } from '@/lib/adminMarketingAccess';
import { unsubscribeMarketing } from '@/lib/adminMarketingDelivery';
import { hasTrustedAdminOrigin } from '@/lib/adminMfa';
import { consumeRateLimit, requestIp } from '@/lib/security';
export async function POST(req:NextRequest) {
  if(!marketingEnabled())return NextResponse.json({error:'Indisponibil.'},{status:404});
  try {if(!hasTrustedAdminOrigin(req))throw new MarketingError('Origine invalidă.',403);if(!consumeRateLimit('marketing-unsubscribe:'+requestIp(req),20,60000))throw new MarketingError('Prea multe cereri.',429);const b=await marketingBody(req);return NextResponse.json(unsubscribeMarketing(db,b.token));}catch(error){return marketingFailure(error);}
}
