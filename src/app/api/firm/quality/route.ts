import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getFirmQuality } from "@/lib/qualityIndex";

// GET — scorul Nitido Quality Index pentru firma autentificată.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca firmă" }, { status: 401 });
  }
  const firm = getFirmByUserId(user.id);
  if (!firm) return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
  return NextResponse.json({ quality: getFirmQuality(db, firm.id) });
}
