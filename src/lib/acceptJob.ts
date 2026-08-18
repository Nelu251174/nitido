import type { Database } from "better-sqlite3";
import { calcBlockedMinutes, overlapsExisting } from "@/lib/pricing";
import { authorizePayment } from "@/lib/payments";

export type AcceptResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Nucleul mecanismului "primul care apasă câștigă" — extras într-o funcție pură,
 * testabilă independent de Next.js (folosită atât de ruta API cât și de teste).
 * Vezi src/app/api/jobs/[id]/accept/route.ts pentru explicația tehnică completă.
 *
 * Funcție async: autorizarea de plată (Stripe, când e configurat — vezi payments.ts)
 * e un apel de rețea. Dacă eșuează DUPĂ ce job-ul a fost deja marcat 'accepted',
 * facem rollback explicit pe 'waiting' — un client nu trebuie să rămână cu o lucrare
 * "acceptată" fără nicio autorizare de plată în spate.
 */
export async function acceptJobAtomic(
  db: Database,
  jobId: string,
  firmId: string
): Promise<AcceptResult> {
  const firm = db.prepare("SELECT * FROM firms WHERE id = ?").get(firmId) as
    | { id: string; suspended_until: string | null; stripe_account_id: string | null }
    | undefined;
  if (!firm) return { ok: false, error: "Firmă inexistentă", status: 404 };
  if (firm.suspended_until && new Date(firm.suspended_until) > new Date()) {
    return { ok: false, error: "Firma este suspendată temporar", status: 403 };
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as
    | {
        id: string;
        scheduled_at: string | null;
        sqm: number;
        price_gross: number;
        credit_applied: number;
      }
    | undefined;
  if (!job) return { ok: false, error: "Lucrare inexistentă", status: 404 };

  if (job.scheduled_at) {
    const candidateStart = new Date(job.scheduled_at);
    const candidateBlocked = calcBlockedMinutes(job.sqm);
    const otherJobs = db
      .prepare(
        `SELECT scheduled_at, sqm FROM jobs
         WHERE accepted_firm_id = ? AND status IN ('accepted','arrived') AND id != ?`
      )
      .all(firmId, jobId) as { scheduled_at: string; sqm: number }[];
    const existingIntervals = otherJobs
      .filter((j) => j.scheduled_at)
      .map((j) => ({ start: new Date(j.scheduled_at), blockedMinutes: calcBlockedMinutes(j.sqm) }));
    if (overlapsExisting(candidateStart, candidateBlocked, existingIntervals)) {
      return { ok: false, error: "Se suprapune cu o altă lucrare a firmei", status: 409 };
    }
  }

  // Actualizare atomică, condiționată — inima mecanismului. Sincronă, fără niciun
  // `await` înainte — asta garantează excluderea mutuală sub concurență reală.
  const result = db
    .prepare(
      `UPDATE jobs SET status = 'accepted', accepted_firm_id = ?, accepted_at = datetime('now')
       WHERE id = ? AND status = 'waiting'`
    )
    .run(firmId, jobId);

  if (result.changes === 0) {
    return { ok: false, error: "Lucrare preluată de altcineva", status: 409 };
  }

  try {
    await authorizePayment(
      db,
      jobId,
      job.price_gross,
      firm.stripe_account_id,
      job.credit_applied ?? 0
    );
  } catch (err) {
    db.prepare(
      `UPDATE jobs SET status = 'waiting', accepted_firm_id = NULL, accepted_at = NULL WHERE id = ?`
    ).run(jobId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Autorizare plată eșuată",
      status: 502,
    };
  }

  return { ok: true };
}
