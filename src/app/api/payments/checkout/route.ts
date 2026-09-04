import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCardSetupSession } from "@/lib/clientPayments";

/** Pornește salvarea cardului clientului prin Stripe Checkout (mod setup). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  try {
    const result = await createCardSetupSession(db, user.id, baseUrl);
    if (!result.configured || !result.url) {
      return NextResponse.json({ error: "Plățile nu sunt activate momentan." }, { status: 503 });
    }
    return NextResponse.json({ url: result.url });
  } catch (err) {
    return NextResponse.json(
      { error: `Nu s-a putut porni adăugarea cardului: ${err instanceof Error ? err.message : "eroare"}` },
      { status: 502 }
    );
  }
}
