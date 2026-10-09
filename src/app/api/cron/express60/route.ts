import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expireExpress60Guarantees } from "@/lib/express60";

// Backstop programat pentru garanția Express 60: retrogradează lucrările
// premium al căror termen de 60 min a expirat fără preluare (scoate suplimentul
// din price_gross → clientul nu e taxat premium-ul). Protejat cu CRON_SECRET
// (header x-cron-secret). Dezactivat dacă secretul nu e configurat.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Backstop-ul programat nu este activat" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const { breached } = expireExpress60Guarantees(db, new Date());
  return NextResponse.json({ breached: breached.length });
}
