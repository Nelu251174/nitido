import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CardSetupError, getClientCardInfo, syncClientDefaultCard } from "@/lib/clientPayments";
import { consumeRateLimit, hasTrustedMutationOrigin } from "@/lib/security";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Starea cardului clientului (are card salvat sau nu). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return reply({ error: "Neautorizat" }, 401);
  }
  const info = getClientCardInfo(db, user.id);
  return reply({ hasCard: info.hasCard, stripeConfigured: info.stripeConfigured });
}

/** Sincronizează cardul salvat după întoarcerea din Stripe Checkout. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return reply({ error: "Neautorizat" }, 401);
  }
  if (!hasTrustedMutationOrigin(req)) return reply({ error: "Origine nepermisă." }, 403);
  if (!consumeRateLimit(`card-setup-confirm:${user.id}`, 20, 60000)) return reply({ error: "Prea multe încercări. Reîncearcă peste un minut." }, 429);
  const body = await req.json().catch(() => null);
  if (typeof body?.sessionId !== "string") return reply({ error: "Sesiunea cardului lipsește. Pornește din nou adăugarea cardului." }, 400);
  try {
    const hasCard = await syncClientDefaultCard(db, user.id, body.sessionId);
    if (!hasCard) return reply({ error: "Cardul nu a putut fi confirmat momentan." }, 409);
    return reply({ hasCard });
  } catch (err) {
    return reply({ error: err instanceof CardSetupError ? err.message : "Nu s-a putut confirma cardul. Reîncarcă pagina pentru a reîncerca." }, err instanceof CardSetupError ? err.status : 502);
  }
}
