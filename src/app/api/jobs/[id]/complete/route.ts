import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { capturePayment } from "@/lib/payments";
import { JobRow } from "@/lib/types";

// Finalizarea este permisă numai firmei autentificate care deține lucrarea.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca firmă" }, { status: 401 });
  }

  const firm = getFirmByUserId(user.id);
  if (!firm) {
    return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
  }

  const { id } = await params;
  const result = db
    .prepare(
      `UPDATE jobs SET status = 'completed', completed_at = datetime('now')
       WHERE id = ? AND accepted_firm_id = ? AND status IN ('accepted','arrived')`
    )
    .run(id, firm.id);

  if (result.changes === 0) {
    return NextResponse.json(
      { error: "Lucrarea nu poate fi finalizată de această firmă" },
      { status: 409 }
    );
  }

  try {
    await capturePayment(db, id);
  } catch (err) {
    // Nu ascundem o eroare de capturare: lucrarea a fost finalizată operațional,
    // iar reconcilierea plății trebuie tratată explicit de admin/ops.
    return NextResponse.json(
      {
        error: "Lucrarea a fost finalizată, dar capturarea plății a eșuat",
        detail: err instanceof Error ? err.message : "eroare necunoscută",
      },
      { status: 502 }
    );
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;
  return NextResponse.json({ job });
}
