import { after, NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { selectOffer, withdrawOffer } from "@/lib/offers";
import { processPushOutbox, queueAcceptedClientPush } from "@/lib/push";
import { JobRow } from "@/lib/types";

// POST — clientul proprietar alege o ofertă. Lucrarea se blochează pe firma
// aleasă (atomic, ca la Express) și plata se autorizează.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  const { id, offerId } = await params;
  const result = await selectOffer(db, id, offerId, user.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.status === 409 ? "ALREADY_TAKEN" : "SELECT_FAILED" },
      { status: result.status }
    );
  }
  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;
  // Confirmarea către client (aceeași notificare ca la acceptarea directă).
  try {
    const ids = queueAcceptedClientPush(db, id);
    if (ids.length) after(() => processPushOutbox(db, ids));
  } catch {
    console.error("[push-outbox] enqueue_failed JOB_ACCEPTED_CLIENT_PUSH");
  }
  return NextResponse.json({ job: updated });
}

// DELETE — o firmă își retrage propria ofertă (doar cât timp e în așteptare).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca firmă" }, { status: 401 });
  }
  const firm = getFirmByUserId(user.id);
  if (!firm) return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
  const { offerId } = await params;
  const result = withdrawOffer(db, offerId, firm.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
