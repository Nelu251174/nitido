import { NextRequest, NextResponse } from "next/server";
import "@/lib/pro/schema";
import { createLead, rateLimitLead } from "@/lib/pro/leads";
import { notifyProLead } from "@/lib/pro/notify";
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimitLead(ip)) return NextResponse.json({ error: "Prea multe incercari." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  try {
    const id = createLead({ kind: "client", contact_name: String(body.name ?? ""), contact_email: body.email ? String(body.email) : null, contact_phone: body.phone ? String(body.phone) : null, city: body.city ? String(body.city) : null, payload: { contactConsent: Boolean(body.contactConsent) } });
    void notifyProLead({ id, kind: "client", name: String(body.name ?? ""), email: body.email ? String(body.email) : null, phone: body.phone ? String(body.phone) : null, city: body.city ? String(body.city) : null });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Date invalide" }, { status: 400 });
  }
}
