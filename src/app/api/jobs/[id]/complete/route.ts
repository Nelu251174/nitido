import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capturePayment } from "@/lib/payments";
import { JobRow } from "@/lib/types";

// Confirmare finalizare — declanșează capturarea plății (spec secțiunea 5b/10).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = db
    .prepare(
      `UPDATE jobs SET status = 'completed', completed_at = datetime('now')
       WHERE id = ? AND status IN ('accepted','arrived')`
    )
    .run(id);

  if (result.changes === 0) {
    return NextResponse.json(
      { error: "Lucrarea nu e în starea potrivită pentru finalizare" },
      { status: 409 }
    );
  }

  await capturePayment(db, id);

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;
  return NextResponse.json({ job });
}
