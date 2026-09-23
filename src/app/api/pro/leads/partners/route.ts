import { NextRequest, NextResponse } from "next/server";
import "@/lib/pro/schema";
import { createLead, rateLimitLead } from "@/lib/pro/leads";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimitLead(ip)) {
    return NextResponse.json({ error: "Prea multe incercari. Reincearca mai tarziu." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    if (!body.acceptStandards) {
      return NextResponse.json({ error: "Acceptarea standardelor este obligatorie." }, { status: 400 });
    }
    const id = createLead({
      kind: "partner",
      contact_name: String(body.name ?? ""),
      contact_email: body.email ? String(body.email) : null,
      contact_phone: body.phone ? String(body.phone) : null,
      city: body.areas ? String(body.areas) : null,
      payload: {
        serviceTypes: body.serviceTypes ?? null,
        areas: body.areas ?? null,
        availability: body.availability ?? null,
        experience: body.experience ?? null,
        capacity: body.capacity ?? null,
        notes: body.notes ?? null,
        acceptStandards: true,
      },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Date invalide" },
      { status: 400 }
    );
  }
}
