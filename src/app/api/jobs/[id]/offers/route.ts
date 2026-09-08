import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createOffer, listOffersForJob } from "@/lib/offers";

// GET — clientul proprietar vede ofertele primite la lucrarea sa (mod standard).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  const { id } = await params;
  const job = db.prepare("SELECT client_id FROM jobs WHERE id = ?").get(id) as { client_id: string } | undefined;
  if (!job) return NextResponse.json({ error: "Lucrare inexistentă" }, { status: 404 });
  if (user.role !== "client" || job.client_id !== user.id) {
    return NextResponse.json({ error: "Nu ai acces la ofertele acestei lucrări" }, { status: 403 });
  }
  return NextResponse.json({ offers: listOffersForJob(db, id) });
}

// POST — o firmă verificată din zonă trimite o ofertă la o lucrare standard.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca firmă" }, { status: 401 });
  }
  const firm = getFirmByUserId(user.id);
  if (!firm) return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message : null;
  const result = createOffer(db, id, firm.id, message);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ offerId: result.offerId }, { status: 201 });
}
