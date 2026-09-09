import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessProfile, setBusinessProfile } from "@/lib/business";

// GET — profilul de business al clientului.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  }
  return NextResponse.json({ profile: getBusinessProfile(db, user.id) });
}

// POST — activează / actualizează contul business (Nitido Office).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const result = setBusinessProfile(db, user.id, {
    companyName: b?.companyName,
    companyCui: b?.companyCui,
    companyAddress: b?.companyAddress,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, profile: getBusinessProfile(db, user.id) });
}
