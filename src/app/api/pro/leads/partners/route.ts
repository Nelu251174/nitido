import { NextRequest, NextResponse } from "next/server";
import "@/lib/pro/schema";
import { createLead, rateLimitLead } from "@/lib/pro/leads";
import { notifyProLead } from "@/lib/pro/notify";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimitLead(ip)) {
    return NextResponse.json({ error: "Prea multe încercări. Reîncearcă mai târziu." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    if (!body.accurate || !body.noGuarantee || !body.dataConsent) {
      return NextResponse.json({ error: "Confirmările obligatorii trebuie bifate." }, { status: 400 });
    }
    const services = Array.isArray(body.services) ? body.services : [];
    const zones = Array.isArray(body.zones) ? body.zones : [];
    if (services.length < 1 || zones.length < 1) {
      return NextResponse.json({ error: "Alege minim o categorie și o zonă." }, { status: 400 });
    }
    const id = createLead({
      kind: "partner",
      contact_name: String(body.company ?? body.name ?? ""),
      contact_email: body.email ? String(body.email) : null,
      contact_phone: body.phone ? String(body.phone) : null,
      city: zones.join(", "),
      payload: {
        company: body.company ?? null,
        cui: body.cui ?? null,
        legalForm: body.legalForm ?? null,
        representative: body.representative ?? null,
        services,
        zones,
        teams: body.teams ?? null,
        people: body.people ?? null,
        capacity: body.capacity ?? null,
        experience: body.experience ?? null,
        pricing: body.pricing ?? null,
        emergency: body.emergency ?? null,
        accurate: true,
        noGuarantee: true,
        dataConsent: true,
      },
    });
    void notifyProLead({
      id,
      kind: "partner",
      name: String(body.company ?? body.name ?? ""),
      email: body.email ? String(body.email) : null,
      phone: body.phone ? String(body.phone) : null,
      city: zones.join(", "),
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Date invalide" }, { status: 400 });
  }
}
