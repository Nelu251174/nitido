import {db} from "@/lib/db";
import {managedBookingEnabled,bookingPriceContext,issueBookingQuote} from "@/lib/bookingQuotes";
import {ManagedPricingError} from "@/lib/managedPricing";
import {hasTrustedMutationOrigin} from "@/lib/security";
import { pricingSnapshot } from "@/lib/pricingSnapshot";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  AUTOMATIC_MAX_SQM,
  calcGrossPrice,
  calcServicePrice,
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

  const body = (await req.json().catch(() => null)) as { spaceType?: unknown; sqm?: unknown; windowsSqm?:unknown; [key:string]:unknown } | null;
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

  const windowsSqm=body?.windowsSqm??0;
  if(!validWindowsSqm(windowsSqm))return NextResponse.json({error:"Suprafață geamuri invalidă"},{status:400});
  return NextResponse.json({
    quote: {
      spaceType,
      sqm,
      windowsSqm,
      priceGross: calcServicePrice(spaceType as SpaceType, sqm,windowsSqm),
      durationMinutes: calcServiceDuration(sqm,windowsSqm),
      currency: "RON",
      pricing: pricingSnapshot({spaceType:spaceType as SpaceType,sqm,windowsSqm,expressFeeLei:0,creditLei:0}),
    },
    scheduling: { slotHours: SLOT_HOURS, minLeadHours: MIN_LEAD_HOURS },
  });
}
