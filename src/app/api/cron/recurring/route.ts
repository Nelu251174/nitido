import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDueRecurringJobs } from "@/lib/recurring";

// Backstop programat: generează TOATE lucrările recurente scadente.
// Protejat cu CRON_SECRET (header x-cron-secret). Dezactivat dacă secretul
// nu e configurat. Poate fi apelat de un declanșator programat (ex. GitHub
// Actions), independent de vizitele clienților.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Backstop-ul programat nu este activat" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const { created } = await generateDueRecurringJobs(db, new Date());
  return NextResponse.json({ created: created.length });
}
