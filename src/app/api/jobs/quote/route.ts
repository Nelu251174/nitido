import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  calcDurationMinutes,
  calcGrossPrice,
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

  const body = (await req.json().catch(() => null)) as { spaceType?: unknown; sqm?: unknown } | null;
  const spaceType = body?.spaceType;
  const sqm = Number(body?.sqm);

  if (typeof spaceType !== "string" || !SPACE_TYPES.includes(spaceType as SpaceType)) {
    return NextResponse.json({ error: "Tipul serviciului nu este valid" }, { status: 400 });
  }
  if (!Number.isInteger(sqm) || sqm <= 0) {
    return NextResponse.json({ error: "Suprafața trebuie să fie un număr întreg pozitiv" }, { status: 400 });
  }

  return NextResponse.json({
    quote: {
      spaceType,
      sqm,
      priceGross: calcGrossPrice(spaceType as SpaceType, sqm),
      durationMinutes: calcDurationMinutes(sqm),
      currency: "RON",
    },
    scheduling: { slotHours: SLOT_HOURS, minLeadHours: MIN_LEAD_HOURS },
  });
}
