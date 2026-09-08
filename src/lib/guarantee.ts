import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { calcDurationMinutes, BUFFER_MINUTES } from "@/lib/pricing";

/**
 * Nitido Guaranteed (Etapa 3) — re-curățare gratuită.
 * Orice lucrare finalizată poate primi, în fereastra de garanție, o singură
 * re-curățare gratuită de la aceeași echipă. E o reparație (make-good): preț 0,
 * fără plată nouă, alocată direct firmei originale. Funcție pură (primește db).
 */

export const GUARANTEE_WINDOW_HOURS = 48;

export type RecleanResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string; status: number };

interface OrigJob {
  id: string;
  client_id: string;
  accepted_firm_id: string | null;
  status: string;
  completed_at: string | null;
  street: string;
  postal_code: string | null;
  city: string;
  floor: string | null;
  details: string | null;
  sqm: number;
  space_type: string;
  guarantee_of: string | null;
}

/** Este lucrarea încă în fereastra de garanție (≤ 48h de la finalizare)? */
export function isWithinGuaranteeWindow(completedAt: string | null, now: Date = new Date()): boolean {
  if (!completedAt) return false;
  const done = new Date(completedAt).getTime();
  const diff = now.getTime() - done;
  return diff >= 0 && diff <= GUARANTEE_WINDOW_HOURS * 3600 * 1000;
}

/** Clientul cere re-curățarea gratuită pentru o lucrare finalizată. */
export function requestReclean(
  db: Database,
  jobId: string,
  clientId: string,
  now: Date = new Date()
): RecleanResult {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as OrigJob | undefined;
  if (!job) return { ok: false, error: "Lucrare inexistentă", status: 404 };
  if (job.client_id !== clientId) return { ok: false, error: "Lucrarea nu îți aparține", status: 403 };
  if (job.guarantee_of) return { ok: false, error: "O re-curățare nu poate fi ea însăși re-curățată", status: 409 };
  if (job.status !== "completed") return { ok: false, error: "Doar lucrările finalizate au garanție", status: 409 };
  if (!isWithinGuaranteeWindow(job.completed_at, now)) {
    return { ok: false, error: `Garanția expiră la ${GUARANTEE_WINDOW_HOURS}h după finalizare`, status: 409 };
  }
  const existing = db.prepare("SELECT id FROM jobs WHERE guarantee_of = ?").get(jobId) as { id: string } | undefined;
  if (existing) return { ok: false, error: "Ai cerut deja o re-curățare pentru această lucrare", status: 409 };

  const newId = `job_${randomUUID()}`;
  const duration = calcDurationMinutes(job.sqm);
  const assignFirm = job.accepted_firm_id;
  db.prepare(
    `INSERT INTO jobs
       (id, client_id, street, postal_code, city, floor, details, sqm, space_type, when_type,
        scheduled_at, price_gross, credit_applied, duration_minutes, buffer_minutes, photos_count,
        mode, guarantee_of, status, accepted_firm_id, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'asap', NULL, 0, 0, ?, ?, 0, 'express', ?, ?, ?, ?)`
  ).run(
    newId,
    job.client_id,
    job.street,
    job.postal_code,
    job.city,
    job.floor,
    job.details,
    job.sqm,
    job.space_type,
    duration,
    BUFFER_MINUTES,
    jobId,
    assignFirm ? "accepted" : "waiting",
    assignFirm,
    assignFirm ? now.toISOString() : null
  );
  return { ok: true, jobId: newId };
}
