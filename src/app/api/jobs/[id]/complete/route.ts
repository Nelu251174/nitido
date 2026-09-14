import {after,NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { capturePayment } from "@/lib/payments";
import { JobRow } from "@/lib/types";
import { assertCompletionProof, markCompletedWithProof } from "@/lib/proofOfWork";
import {processPushOutbox,queueCompletedClientPush} from "@/lib/push";

import {hasTrustedMutationOrigin} from "@/lib/security";

// Finalizarea este permisă numai firmei autentificate care deține lucrarea.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca firmă" }, { status: 401 });
  }

  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:"Origine nepermisă"},{status:403});
  const firm = getFirmByUserId(user.id);
  if (!firm) {
    return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
  }

  const { id } = await params;
  const existing=db.prepare("SELECT status,accepted_firm_id FROM jobs WHERE id=?").get(id) as {status:string;accepted_firm_id:string|null}|undefined;
  if(existing?.status==="completed" && existing.accepted_firm_id===firm.id){
    try{assertCompletionProof(db,id);}catch{return NextResponse.json({error:"Dovada finalizării nu este validă"},{status:409});}
  }else{
    const result = markCompletedWithProof(db,id,firm.id,user.id);
    if (!result.ok) return NextResponse.json({error:result.error},{status:result.status});
  }
  db.prepare("DELETE FROM job_live_locations WHERE job_id=?").run(id);

  // Re-curățările în garanție (Nitido Guaranteed) sunt gratuite: preț 0, fără
  // plată de capturat. Sărim peste capturare pentru ele.
  const guaranteeRow = db.prepare("SELECT guarantee_of FROM jobs WHERE id=?").get(id) as {guarantee_of:string|null}|undefined;
  if (!guaranteeRow?.guarantee_of) {
    try {
      await capturePayment(db, id);
    } catch {
      // Nu ascundem o eroare de capturare: lucrarea a fost finalizată operațional,
      // iar reconcilierea plății trebuie tratată explicit de admin/ops.
      return NextResponse.json(
        {
          error: "Lucrarea a fost finalizată, dar capturarea plății a eșuat",
          code: "PAYMENT_CAPTURE_RETRY_REQUIRED",
          retryable: true,
        },
        { status: 502 }
      );
    }
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;
  try{const ids=queueCompletedClientPush(db,id);if(ids.length)after(()=>processPushOutbox(db,ids));}
  catch{console.error("[push-outbox] enqueue_failed JOB_COMPLETED_CLIENT_PUSH");}
  return NextResponse.json({ job });
}
