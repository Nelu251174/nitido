import {after,NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { capturePayment } from "@/lib/payments";
import { JobRow } from "@/lib/types";
import { markCompletedWithProof } from "@/lib/proofOfWork";
import {processPushOutbox,queueCompletedClientPush} from "@/lib/push";

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
  const result = markCompletedWithProof(db,id,firm.id,user.id);
  if (!result.ok) return NextResponse.json({error:result.error},{status:result.status});
  db.prepare("DELETE FROM job_live_locations WHERE job_id=?").run(id);

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
  try{const ids=queueCompletedClientPush(db,id);if(ids.length)after(()=>processPushOutbox(db,ids));}
  catch{console.error("[push-outbox] enqueue_failed JOB_COMPLETED_CLIENT_PUSH");}
  return NextResponse.json({ job });
}
