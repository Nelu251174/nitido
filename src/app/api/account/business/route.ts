import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, hasTrustedMutationOrigin } from "@/lib/security";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessProfile, setBusinessProfile } from "@/lib/business";

// GET — profilul de business al clientului.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  }
  return NextResponse.json({ profile: getBusinessProfile(db, user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST — activează / actualizează contul business (Nitido Office).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  if (!hasTrustedMutationOrigin(req)) return NextResponse.json({ error: "Origine invalidă" }, { status: 403 });
  if (!consumeRateLimit(`business-profile:${user.id}`, 20, 60000)) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 10000) return NextResponse.json({ error: "Cerere prea mare" }, { status: 413 });
  let b;
  try { b = JSON.parse(raw); } catch { return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 }); }
  if (!b || typeof b !== "object" || Array.isArray(b)) return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  const result = setBusinessProfile(db, user.id, {
    companyName: b?.companyName,
    companyCui: b?.companyCui,
    companyAddress: b?.companyAddress,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, profile: getBusinessProfile(db, user.id) });
}
