import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCardSetupSession } from "@/lib/clientPayments";
import { consumeRateLimit, hasTrustedMutationOrigin } from "@/lib/security";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Pornește salvarea cardului clientului prin Stripe Checkout (mod setup). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return reply({ error: "Trebuie să fii autentificat ca client" }, 401);
  }
  if (!hasTrustedMutationOrigin(req)) return reply({ error: "Origine nepermisă." }, 403);
  if (!consumeRateLimit(`card-setup:${user.id}`, 10, 60000)) return reply({ error: "Prea multe încercări. Reîncearcă peste un minut." }, 429);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  try {
    const result = await createCardSetupSession(db, user.id, baseUrl);
    if (!result.configured || !result.url) {
      return reply({ error: "Plățile nu sunt activate momentan." }, 503);
    }
    return reply({ url: result.url });
  } catch {
    return reply({ error: "Nu s-a putut deschide formularul de card. Reîncearcă." }, 502);
  }
}
