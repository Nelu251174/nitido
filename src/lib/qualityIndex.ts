import type { Database } from "better-sqlite3";

/**
 * Nitido Quality Index (Etapa 2/3) — scor transparent 0–100 per firmă, folosit
 * pentru a împinge firmele bune în față la ofertele Standard. Compus din:
 *   - Rating clienți (până la 60 pct)
 *   - Experiență / lucrări finalizate (până la 20 pct)
 *   - Fiabilitate / lipsă strikes (până la 20 pct)
 * Formula e explicită (fără „scor misterios"). Funcții pure (primesc db).
 */

export interface QualityInputs {
  avgStars: number | null;
  ratingCount: number;
  completedJobs: number;
  strikes90d: number;
  verified: boolean;
}

export interface QualityScore {
  score: number; // 0–100
  rating: number; // 0–60
  experience: number; // 0–20
  reliability: number; // 0–20
}

export function computeQualityScore(i: QualityInputs): QualityScore {
  const rating = i.avgStars != null ? Math.round((i.avgStars / 5) * 60) : 0;
  const experience = Math.round((Math.min(i.completedJobs, 50) / 50) * 20);
  const reliability = Math.max(0, 20 - Math.min(i.strikes90d, 4) * 5);
  const score = Math.max(0, Math.min(100, rating + experience + reliability));
  return { score, rating, experience, reliability };
}

/** Datele + scorul de calitate pentru o firmă. */
export function getFirmQuality(db: Database, firmId: string): QualityScore & QualityInputs {
  const agg = db
    .prepare(
      `SELECT
         (SELECT AVG(stars) FROM ratings r WHERE r.firm_id = ? AND r.status = 'active') AS avgStars,
         (SELECT COUNT(*)   FROM ratings r WHERE r.firm_id = ? AND r.status = 'active') AS ratingCount,
         (SELECT COUNT(*)   FROM jobs j   WHERE j.accepted_firm_id = ? AND j.status = 'completed') AS completedJobs`
    )
    .get(firmId, firmId, firmId) as { avgStars: number | null; ratingCount: number; completedJobs: number };
  const firm = db.prepare("SELECT strikes_90d, verified FROM firms WHERE id = ?").get(firmId) as
    | { strikes_90d: number; verified: number }
    | undefined;

  const inputs: QualityInputs = {
    avgStars: agg.avgStars != null ? Number(agg.avgStars) : null,
    ratingCount: agg.ratingCount ?? 0,
    completedJobs: agg.completedJobs ?? 0,
    strikes90d: firm?.strikes_90d ?? 0,
    verified: Boolean(firm?.verified),
  };
  return { ...inputs, ...computeQualityScore(inputs) };
}
