import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingAccess,marketingBody,marketingFailure } from '@/lib/adminMarketingAccess';
import { MarketingError } from '@/lib/adminMarketing';
import { marketingCountyView,setMarketingCountyState,startMarketingCountyPlan } from '@/lib/adminMarketingCounty';
export async function GET(req:NextRequest){const a=await marketingAccess(req);if(a.error)return a.error;try{return NextResponse.json(marketingCountyView(db));}catch(e){return marketingFailure(e);}}
export async function POST(req:NextRequest){const a=await marketingAccess(req,true);if(a.error)return a.error;try{const b=await marketingBody(req);if(b.action==='start')return NextResponse.json(startMarketingCountyPlan(db,a.actor!),{status:202});if(typeof b.code==='string'&&['pause','resume'].includes(String(b.action)))return NextResponse.json(setMarketingCountyState(db,b.code,String(b.action),a.actor!));throw new MarketingError('Acțiune invalidă.');}catch(e){return marketingFailure(e);}}
