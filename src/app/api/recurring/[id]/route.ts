import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { setPlanStatus } from "@/lib/recurring";

// POST — schimbă starea abonamentului (pauză / reactivare / anulare).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const status = b?.status;
  if (status !== "active" && status !== "paused" && status !== "cancelled") {
    return NextResponse.json({ error: "Stare invalidă" }, { status: 400 });
  }
  const result = setPlanStatus(db, id, user.id, status);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
