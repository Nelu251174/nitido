import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingAccess, marketingBody, marketingFailure } from '@/lib/adminMarketingAccess';
import { MarketingError } from '@/lib/adminMarketing';
import { cancelMarketingDiscovery, getMarketingDiscovery, startMarketingDiscovery } from '@/lib/adminMarketingDiscovery';
export async function GET(req:NextRequest) {const access=await marketingAccess(req);if(access.error)return access.error;try{return NextResponse.json(getMarketingDiscovery(db,req.nextUrl.searchParams.get('id')??''));}catch(error){return marketingFailure(error);}}
export async function POST(req:NextRequest) {const access=await marketingAccess(req,true);if(access.error)return access.error;try{const b=await marketingBody(req);if(b.action==='cancel' && typeof b.id==='string')return NextResponse.json(cancelMarketingDiscovery(db,b.id));if(b.action!=='start')throw new MarketingError('Acțiune invalidă.');return NextResponse.json(startMarketingDiscovery(db,b.data,access.actor!),{status:202});}catch(error){return marketingFailure(error);}}
