import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { cancelPayment } from "@/lib/payments";
import { JobRow } from "@/lib/types";

/**
 * Job Rescue (Etapa 3) — dacă o firmă renunță la o lucrare acceptată (înainte de
 * a ajunge), sistemul eliberează hold-ul de plată, marchează lucrarea originală
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

  // Eliberează hold-ul de plată al firmei care renunță (dacă exista o autorizare).
  try {
    await cancelPayment(db, jobId);
  } catch {
    /* dacă nu era nicio autorizare de anulat, continuăm cu repunerea */
  }

  // Marchează lucrarea originală ca anulată (atomic, doar dacă e încă 'accepted').
  const changed = db
    .prepare("UPDATE jobs SET status = 'cancelled' WHERE id = ? AND status = 'accepted'")
    .run(jobId);
  if (changed.changes === 0) {
    return { ok: false, error: "Lucrarea nu mai e în starea acceptată", status: 409 };
  }

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

  return { ok: true, newJobId };
}
