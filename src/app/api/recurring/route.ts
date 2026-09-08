import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getClientCardInfo } from "@/lib/clientPayments";
import { createRecurringPlan, listPlansForClient, generateDueRecurringJobs } from "@/lib/recurring";
import type { SpaceType } from "@/lib/pricing";

// GET — abonamentele clientului. Rulează întâi generarea lucrărilor scadente
// pentru planurile acestui client (backstop: pornește abonamentul la vizită).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  }
  try {
    await generateDueRecurringJobs(db, new Date(), user.id);
  } catch {
    // Generarea eșuată nu trebuie să blocheze afișarea abonamentelor.
    console.error("[recurring] generate_on_view_failed");
  }
  return NextResponse.json({ plans: listPlansForClient(db, user.id) });
}

// POST — creează un abonament recurent.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  // Card necesar: lucrările generate autorizează plata automat pe firma preferată.
  const card = getClientCardInfo(db, user.id);
  if (card.stripeConfigured && !card.hasCard) {
    return NextResponse.json(
      { error: "Adaugă un card înainte de a crea un abonament.", needsCard: true },
      { status: 402 }
    );
  }

  const b = await req.json().catch(() => ({}));
  const result = createRecurringPlan(db, {
    clientId: user.id,
    preferredFirmId: typeof b?.preferredFirmId === "string" ? b.preferredFirmId : null,
    frequency: b?.frequency,
    street: b?.street,
    postalCode: b?.postalCode ?? null,
    city: b?.city,
    floor: b?.floor ?? null,
    sqm: Number(b?.sqm),
    spaceType: b?.spaceType as SpaceType,
    hour: Number(b?.hour),
    details: b?.details ?? null,
    startDate: b?.startDate,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ planId: result.planId }, { status: 201 });
}
