import type { Database } from "better-sqlite3";
import { newId } from "@/lib/db";
import { cancelPayment } from "@/lib/payments";
import { determineConsequence } from "@/lib/strikes";
import { JobRow } from "@/lib/types";

export type NoShowResult =
  | { ok: true; consequence: string; repostedJobId: string | null }
  | { ok: false; error: string; status: number };

/**
 * No-show — spec secțiunea 5b. Extras într-o funcție reutilizabilă atât de ruta API
 * (declanșare manuală/admin) cât și de scheduler-ul in-process (src/lib/noShowScheduler.ts,
 * task automat) — aceeași logică, două puncte de intrare.
 */
export async function markNoShow(
  db: Database,
  jobId: string,
  repost: boolean
): Promise<NoShowResult> {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  if (!job) return { ok: false, error: "Lucrare inexistentă", status: 404 };
  if (job.status !== "accepted" || !job.accepted_firm_id) {
    return {
      ok: false,
      error: "Doar lucrările acceptate, neconfirmate, pot fi marcate no-show",
      status: 409,
    };
  }

  const firmId = job.accepted_firm_id;

  const result = db
    .prepare(`UPDATE jobs SET status = 'no_show' WHERE id = ? AND status = 'accepted'`)
    .run(jobId);
  if (result.changes === 0) {
    return { ok: false, error: "Lucrarea nu mai e în starea acceptată", status: 409 };
  }

  await cancelPayment(db, jobId);

  // Strike automat — nu depinde de o recenzie manuală a clientului.
  db.prepare(
    `INSERT INTO strikes (id, firm_id, job_id, reason) VALUES (?, ?, ?, 'no_show')`
  ).run(newId("strike"), firmId, jobId);

  const firm = db.prepare("SELECT * FROM firms WHERE id = ?").get(firmId) as {
    strikes_30d: number;
    strikes_90d: number;
  };
  const newStrikes30d = firm.strikes_30d + 1;
  const newStrikes90d = firm.strikes_90d + 1;
  const consequence = determineConsequence(newStrikes30d, newStrikes90d);

  let suspendedUntil: string | null = null;
  if (consequence === "suspend_7d") {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    suspendedUntil = until.toISOString();
  } else if (consequence === "suspend_permanent") {
    const until = new Date();
    until.setFullYear(until.getFullYear() + 100); // suspendare permanentă, cu contestație posibilă
    suspendedUntil = until.toISOString();
  }

  db.prepare(
    `UPDATE firms SET strikes_30d = ?, strikes_90d = ?, suspended_until = COALESCE(?, suspended_until) WHERE id = ?`
  ).run(newStrikes30d, newStrikes90d, suspendedUntil, firmId);

  let repostedJobId: string | null = null;
  if (repost) {
    repostedJobId = newId("job");
    db.prepare(
      `INSERT INTO jobs
        (id, client_id, street, postal_code, city, floor, sqm, space_type, when_type,
         scheduled_at, price_gross, duration_minutes, buffer_minutes, photos_count, status)
       SELECT ?, client_id, street, postal_code, city, floor, sqm, space_type, when_type,
              NULL, price_gross, duration_minutes, buffer_minutes, photos_count, 'waiting'
       FROM jobs WHERE id = ?`
    ).run(repostedJobId, jobId);
  }

  return { ok: true, consequence, repostedJobId };
}
