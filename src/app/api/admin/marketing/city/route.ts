import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingAccess, marketingBody, marketingFailure } from '@/lib/adminMarketingAccess';
import { MarketingError } from '@/lib/adminMarketing';
import { exportMarketingCity, marketingCityView, setMarketingCityState, startMarketingCity } from '@/lib/adminMarketingCity';
export async function GET(req:NextRequest){
 const access=await marketingAccess(req);if(access.error)return access.error;
 try{
  const id=req.nextUrl.searchParams.get('id')??undefined;
  if(req.nextUrl.searchParams.get('format')==='csv'){
   if(!id)throw new MarketingError('Selectează colectarea.');
   return new NextResponse(exportMarketingCity(db,id),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="firme-municipiu.csv"','Cache-Control':'private, no-store'}});
  }
  return NextResponse.json({view:marketingCityView(db,id,Number(req.nextUrl.searchParams.get('page')??1))});
 }catch(error){return marketingFailure(error);}
}
export async function POST(req:NextRequest){
 const access=await marketingAccess(req,true);if(access.error)return access.error;
 try{
  const body=await marketingBody(req);
  if(body.action==='start')return NextResponse.json({view:startMarketingCity(db,body.data,access.actor!)},{status:202});
  if(typeof body.id==='string'&&['pause','resume','cancel'].includes(String(body.action)))return NextResponse.json({view:setMarketingCityState(db,body.id,String(body.action),access.actor!)});
  throw new MarketingError('Acțiune de colectare invalidă.');
 }catch(error){return marketingFailure(error);}
}
