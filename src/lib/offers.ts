import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { firmCoversCity } from "@/lib/text";
import { acceptJobAtomic, type AcceptResult } from "@/lib/acceptJob";
import { computeQualityScore } from "@/lib/qualityIndex";

/**
 * Motorul „selecției pe calitate" (repoziționare Etapa 2) — pandantul lui
 * acceptJobAtomic, dar pentru lucrările în mod 'standard':
 *   - firmele verificate din zonă trimit O ofertă (createOffer),
 *   - clientul le vede cu semnalele de calitate (listOffersForJob),
 *   - clientul alege una (selectOffer) → lucrarea se blochează pe firma aleasă
 *     prin EXACT aceeași funcție atomică folosită la Express (acceptJobAtomic),
 *     deci garanția de excludere mutuală și autorizarea plății rămân identice.
 *
 * Prețul rămâne fix (calcGrossPrice) — oferta e interes + mesaj, nu negociere.
 * Funcții pure (primesc `db` ca parametru), testabile fără Next.js.
 */

type FirmRow = {
  id: string;
  suspended_until: string | null;
  verified: number;
  coverage_city: string;
  coverage_cities_extra: string | null;
};

type JobRow = {
  id: string;
  client_id: string;
  city: string;
  status: string;
  mode: string;
};

export type OfferResult =
  | { ok: true; offerId: string }
  | { ok: false; error: string; status: number };

export type OfferSummary = {
  offerId: string;
  firmId: string;
  firmName: string;
  message: string | null;
  status: string;
  ratingAvg: number | null;
  ratingCount: number;
  completedJobs: number;
  qualityScore: number; // Nitido Quality Index (0–100)
  createdAt: string;
};

/** O firmă verificată din zonă trimite (sau reactivează) o ofertă la o lucrare 'standard'. */
export function createOffer(
  db: Database,
  jobId: string,
  firmId: string,
  message?: string | null
): OfferResult {
  const firm = db
    .prepare(
      "SELECT id, suspended_until, verified, coverage_city, coverage_cities_extra FROM firms WHERE id = ?"
    )
    .get(firmId) as FirmRow | undefined;
  if (!firm) return { ok: false, error: "Firmă inexistentă", status: 404 };
  if (!firm.verified) return { ok: false, error: "Firma nu este verificată", status: 403 };
  if (firm.suspended_until && new Date(firm.suspended_until) > new Date()) {
    return { ok: false, error: "Firma este suspendată temporar", status: 403 };
  }

  const job = db
    .prepare("SELECT id, client_id, city, status, mode FROM jobs WHERE id = ?")
    .get(jobId) as JobRow | undefined;
  if (!job) return { ok: false, error: "Lucrare inexistentă", status: 404 };
  if (job.mode !== "standard") {
    return { ok: false, error: "Lucrarea nu primește oferte (nu este în mod standard)", status: 409 };
  }
  if (job.status !== "waiting") {
    return { ok: false, error: "Lucrarea nu mai este disponibilă", status: 409 };
  }
  if (!firmCoversCity(firm.coverage_city, firm.coverage_cities_extra, job.city)) {
    return { ok: false, error: "Lucrarea este în afara zonei firmei", status: 403 };
  }

  const trimmed =
    typeof message === "string" ? message.trim().slice(0, 500) || null : null;

  const existing = db
    .prepare("SELECT id, status FROM offers WHERE job_id = ? AND firm_id = ?")
    .get(jobId, firmId) as { id: string; status: string } | undefined;
  if (existing) {
    if (existing.status === "withdrawn") {
      db.prepare(
        "UPDATE offers SET status='pending', message=?, updated_at=datetime('now') WHERE id=?"
      ).run(trimmed, existing.id);
      return { ok: true, offerId: existing.id };
    }
    return { ok: false, error: "Ai trimis deja o ofertă la această lucrare", status: 409 };
  }

  const offerId = `offer_${randomUUID()}`;
  db.prepare(
    "INSERT INTO offers (id, job_id, firm_id, message, status) VALUES (?, ?, ?, ?, 'pending')"
  ).run(offerId, jobId, firmId, trimmed);
  return { ok: true, offerId };
}

/** Ofertele active pentru o lucrare, cu semnalele de calitate + Quality Index, sortate pe scor. */
export function listOffersForJob(db: Database, jobId: string): OfferSummary[] {
  const rows = db
    .prepare(
      `SELECT o.id AS offerId, o.firm_id AS firmId, o.message AS message, o.status AS status,
              o.created_at AS createdAt, u.name AS firmName, f.strikes_90d AS strikes90d,
              (SELECT ROUND(AVG(stars),2) FROM ratings r WHERE r.firm_id = o.firm_id AND r.status='active') AS ratingAvg,
              (SELECT COUNT(*)           FROM ratings r WHERE r.firm_id = o.firm_id AND r.status='active') AS ratingCount,
              (SELECT COUNT(*)           FROM jobs j   WHERE j.accepted_firm_id = o.firm_id AND j.status='completed') AS completedJobs
       FROM offers o
       JOIN firms f ON f.id = o.firm_id
       JOIN users u ON u.id = f.user_id
       WHERE o.job_id = ? AND o.status IN ('pending','accepted')`
    )
    .all(jobId) as (Omit<OfferSummary, "qualityScore"> & { strikes90d: number })[];

  return rows
    .map(({ strikes90d, ...r }) => ({
      ...r,
      qualityScore: computeQualityScore({
        avgStars: r.ratingAvg,
        ratingCount: r.ratingCount,
        completedJobs: r.completedJobs,
        strikes90d: strikes90d ?? 0,
        verified: true,
      }).score,
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore || b.completedJobs - a.completedJobs || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Clientul alege o ofertă. Blochează lucrarea pe firma aleasă (atomic, exact ca
 * la Express) + autorizează plata; apoi marchează oferta câștigătoare 'accepted'
 * și restul 'rejected'. Async pentru că autorizarea de plată e un apel de rețea.
 */
export async function selectOffer(
  db: Database,
  jobId: string,
  offerId: string,
  clientId: string
): Promise<AcceptResult> {
  const job = db
    .prepare("SELECT id, client_id, city, status, mode FROM jobs WHERE id = ?")
    .get(jobId) as JobRow | undefined;
  if (!job) return { ok: false, error: "Lucrare inexistentă", status: 404 };
  if (job.client_id !== clientId) return { ok: false, error: "Lucrarea nu îți aparține", status: 403 };
  if (job.mode !== "standard") return { ok: false, error: "Lucrarea nu se selectează prin ofertă", status: 409 };
  if (job.status !== "waiting") return { ok: false, error: "Lucrarea nu mai este disponibilă", status: 409 };

  const offer = db
    .prepare("SELECT id, firm_id, status FROM offers WHERE id = ? AND job_id = ?")
    .get(offerId, jobId) as { id: string; firm_id: string; status: string } | undefined;
  if (!offer) return { ok: false, error: "Ofertă inexistentă", status: 404 };
  if (offer.status !== "pending") return { ok: false, error: "Oferta nu mai este validă", status: 409 };

  const result = await acceptJobAtomic(db, jobId, offer.firm_id);
  if (!result.ok) return result;

  db.prepare("UPDATE offers SET status='accepted', updated_at=datetime('now') WHERE id=?").run(offer.id);
  db.prepare(
    "UPDATE offers SET status='rejected', updated_at=datetime('now') WHERE job_id=? AND id != ? AND status='pending'"
  ).run(jobId, offer.id);
  return { ok: true };
}

/** O firmă își retrage oferta (doar cât timp e 'pending'). */
export function withdrawOffer(db: Database, offerId: string, firmId: string): OfferResult {
  const offer = db
    .prepare("SELECT id, status FROM offers WHERE id = ? AND firm_id = ?")
    .get(offerId, firmId) as { id: string; status: string } | undefined;
  if (!offer) return { ok: false, error: "Ofertă inexistentă", status: 404 };
  if (offer.status !== "pending") return { ok: false, error: "Oferta nu poate fi retrasă", status: 409 };
  db.prepare("UPDATE offers SET status='withdrawn', updated_at=datetime('now') WHERE id=?").run(offerId);
  return { ok: true, offerId };
}
