import {validAutomaticCleaningType,cleaningAssessmentUrl} from '@/lib/cleaningTypes';
import {db} from "@/lib/db";
import {configuredServiceMarket,ServiceMarketError} from '@/lib/serviceMarkets';
import {managedBookingEnabled,bookingPriceContext,issueBookingQuote} from "@/lib/bookingQuotes";
import {ManagedPricingError} from "@/lib/managedPricing";
import {hasTrustedMutationOrigin} from "@/lib/security";
import { pricingSnapshot } from "@/lib/pricingSnapshot";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  AUTOMATIC_MAX_SQM,
  calcGrossPrice,
  calcServicePrice,validBathroomCount,
  calcServiceDuration,
  validWindowsSqm,
  MIN_LEAD_HOURS,
  SLOT_HOURS,
  type SpaceType,
} from "@/lib/pricing";

const SPACE_TYPES: readonly SpaceType[] = ["apartament", "casa", "birou", "altul"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { spaceType?: unknown; sqm?: unknown; windowsSqm?:unknown;countryCode?:unknown;currency?:unknown; [key:string]:unknown } | null;
  let market;
  try{market=configuredServiceMarket(body??{});}catch(error){if(error instanceof ServiceMarketError)return NextResponse.json({error:error.message,countryCode:error.countryCode,currency:error.currency},{status:error.status});throw error;}
  const cleaningType=body?.cleaningType===undefined?'general':body.cleaningType;
  if(!validAutomaticCleaningType(cleaningType))return NextResponse.json({error:'Tipul curățeniei necesită evaluare.',assessmentRequired:cleaningType==='renovation',assessmentUrl:cleaningAssessmentUrl(String(body?.city??''),Number(body?.sqm)||100)},{status:cleaningType==='renovation'?422:400});
  if(managedBookingEnabled()){
    if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:"Origine invalidă"},{status:403});
    try{
      const context=bookingPriceContext(body??{});
      const quote=issueBookingQuote(db,user.id,context);
      return NextResponse.json({managed:true,quote,scheduling:{slotHours:SLOT_HOURS,minLeadHours:MIN_LEAD_HOURS}},{headers:{"Cache-Control":"no-store"}});
    }catch(e){if(e instanceof ManagedPricingError)return NextResponse.json({error:e.message},{status:e.status});throw e;}
  }
  const spaceType = body?.spaceType;
  const sqm = Number(body?.sqm);

  if (typeof spaceType !== "string" || !SPACE_TYPES.includes(spaceType as SpaceType)) {
    return NextResponse.json({ error: "Tipul serviciului nu este valid" }, { status: 400 });
  }
  if (!Number.isSafeInteger(sqm) || sqm <= 0 || !Number.isSafeInteger(calcGrossPrice(spaceType as SpaceType,sqm)*100)) {
    return NextResponse.json({ error: "Suprafața trebuie să fie un număr întreg pozitiv" }, { status: 400 });
  }

  if(sqm>AUTOMATIC_MAX_SQM)return NextResponse.json({error:"Suprafața necesită evaluare asistată înainte de rezervare.",assessmentRequired:true,assessmentUrl:"/client/evaluari"},{status:422});

  const bathroomCount=body?.bathroomCount;
  if(!validBathroomCount(bathroomCount))return NextResponse.json({error:"Confirmă numărul de băi, întreg între 0 și 20."},{status:400});
  const windowsSqm=body?.windowsSqm??0;
  if(!validWindowsSqm(windowsSqm))return NextResponse.json({error:"Suprafață geamuri invalidă"},{status:400});
  return NextResponse.json({
    quote: {
      spaceType,
      sqm,
      windowsSqm,bathroomCount,cleaningType,
      priceGross: calcServicePrice(spaceType as SpaceType, sqm,windowsSqm,bathroomCount,cleaningType),
      durationMinutes: calcServiceDuration(sqm,windowsSqm),
      ...market,
      pricing: pricingSnapshot({spaceType:spaceType as SpaceType,sqm,windowsSqm,bathroomCount,cleaningType,expressFeeLei:0,creditLei:0}),
    },
    scheduling: { slotHours: SLOT_HOURS, minLeadHours: MIN_LEAD_HOURS },
  });
}
