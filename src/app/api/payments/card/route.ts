import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClientCardInfo, syncClientDefaultCard } from "@/lib/clientPayments";

/** Starea cardului clientului (are card salvat sau nu). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const info = getClientCardInfo(db, user.id);
  return NextResponse.json({ hasCard: info.hasCard, stripeConfigured: info.stripeConfigured });
}

/** Sincronizează cardul salvat după întoarcerea din Stripe Checkout. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  try {
    const hasCard = await syncClientDefaultCard(db, user.id);
    return NextResponse.json({ hasCard });
  } catch (err) {
    return NextResponse.json(
      { error: `Nu s-a putut confirma cardul: ${err instanceof Error ? err.message : "eroare"}` },
      { status: 502 }
    );
  }
}
