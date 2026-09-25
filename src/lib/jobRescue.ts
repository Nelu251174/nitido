import {freezeExecutionRules} from '@/lib/executionTemplates';
import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {requestPaymentCancellation} from "@/lib/paymentCancellation";
import { cancelPayment } from "@/lib/payments";
import { JobRow } from "@/lib/types";

/**
 * Job Rescue (Etapa 3) — dacă o firmă renunță la o lucrare acceptată (înainte de
 * a ajunge), sistemul solicită eliberarea hold-ului și marchează lucrarea originală
 * 'cancelled' și REPUNE automat o lucrare nouă în piață (păstrând modul
 * Express/Standard și detaliile), ca altă firmă s-o preia. Clientul nu rămâne
 * pe drumuri. Funcție pură (primește db).
 */

export type RescueResult =
  | { ok: true; newJobId: string }
  | { ok: false; error: string; status: number };

export async function rescueAcceptedJob(
  db: Database,
  jobId: string,
  byFirmId?: string
): Promise<RescueResult> {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  if (!job) return { ok: false, error: "Lucrare inexistentă", status: 404 };
  if (byFirmId && job.accepted_firm_id !== byFirmId) {
    return { ok: false, error: "Lucrarea nu este alocată firmei tale", status: 403 };
  }
  if (job.status !== "accepted") {
    return { ok: false, error: "Doar lucrările acceptate (neîncepute) pot fi renunțate", status: 409 };
  }

  const outcome=db.transaction(():RescueResult=>{
    // Marchează lucrarea originală ca anulată (atomic, doar dacă e încă 'accepted').
    const changed = db
      .prepare("UPDATE jobs SET status = 'cancelled' WHERE id = ? AND status = 'accepted' AND accepted_firm_id = ?")
      .run(jobId,job.accepted_firm_id);
    if (changed.changes === 0) {
      return { ok: false, error: "Lucrarea nu mai e în starea acceptată", status: 409 };
    }

    requestPaymentCancellation(db,jobId);

    // Repune o lucrare nouă, păstrând modul (Express/Standard) și detaliile.
    const newJobId = `job_${randomUUID()}`;
    db.prepare(
      `INSERT INTO jobs
         (id, client_id, street, postal_code, city, floor, details, sqm, space_type, when_type,
          scheduled_at, price_gross, credit_applied, duration_minutes, buffer_minutes, photos_count, mode, status)
       SELECT ?, client_id, street, postal_code, city, floor, details, sqm, space_type, when_type,
              scheduled_at, price_gross, 0, duration_minutes, buffer_minutes, photos_count, mode, 'waiting'
       FROM jobs WHERE id = ?`
    ).run(newJobId, jobId);
    freezeExecutionRules(db,newJobId,'standard',jobId);

    return { ok: true, newJobId };
  })();
  if(outcome.ok){
    try{await cancelPayment(db,jobId);}catch{/* Cererea durabilă rămâne vizibilă pentru reconciliere. */}
  }
  return outcome;
}
