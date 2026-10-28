import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingAccess, marketingBody, marketingFailure } from '@/lib/adminMarketingAccess';
import { MarketingError } from '@/lib/adminMarketing';
import { cancelMarketingRun, marketingCapturedMessages, marketingDeliveryReport, queueMarketingCampaign, regrantMarketingContact, resumeMarketingProvider } from '@/lib/adminMarketingDelivery';
import { requestMarketingDeliveryProcessing } from '@/lib/adminMarketingScheduler';
export async function GET(req:NextRequest) {
  const access=await marketingAccess(req);if(access.error)return access.error;
  try {const id=req.nextUrl.searchParams.get('run');return NextResponse.json(id?{messages:marketingCapturedMessages(db,id)}:marketingDeliveryReport(db));}catch(error){return marketingFailure(error);}
}
export async function POST(req:NextRequest) {
  const access=await marketingAccess(req,true);if(access.error)return access.error;
  try {const b=await marketingBody(req);let result;
    if(b.action==='queue'){result=queueMarketingCampaign(db,b.data,access.actor!);requestMarketingDeliveryProcessing(db);}
    else if(b.action==='regrant')result=regrantMarketingContact(db,b.data,access.actor!);
    else if(b.action==='process')result=requestMarketingDeliveryProcessing(db);
    else if(b.action==='resumeProvider'&&b.confirmed===true){resumeMarketingProvider(db,access.actor!);result=requestMarketingDeliveryProcessing(db);}
    else if(b.action==='cancel' && typeof b.id==='string')result=cancelMarketingRun(db,b.id,access.actor!);
    else throw new MarketingError('Acțiune invalidă.');return NextResponse.json({result});
  }catch(error){return marketingFailure(error);}
}
