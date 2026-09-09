import type { Database } from "better-sqlite3";

// Express 60 (Pachet C, modulul 2)
// --------------------------------
// Tier PREMIUM pentru urgențe reale: preluare GARANTATĂ în 60 de minute.
// E o versiune premium a modului „express" (primul care apasă câștigă), cu:
//   - un supliment fix plătit de client (peste prețul curățeniei),
//   - prioritate maximă în feed-ul firmelor (sus + badge distinct),
//   - o garanție: dacă nicio firmă nu preia în 60 de minute, suplimentul NU
//     se percepe (lucrarea continuă ca express standard) — vezi mai jos.
//
// Model de bani (cheia implementării):
// Suplimentul se BAKE în price_gross la postare. HOLD-ul pe card se pune abia
// la ACCEPTARE — deci suplimentul se percepe DOAR dacă o firmă chiar preia.
// Dacă garanția nu e respectată (nimeni în 60 min), scoatem suplimentul din
// price_gross înainte de orice hold → clientul nu plătește premium-ul pentru
// un serviciu nelivrat. Astfel „primești suplimentul înapoi" e livrat ca
// „nu ești taxat", ceea ce e curat și nu poate fi exploatat pentru credit.

export const EXPRESS_60_FEE_LEI = 79;
export const EXPRESS_60_WINDOW_MINUTES = 60;

export type Express60Status = "pending" | "met" | "breached";

/** Termenul-limită al garanției: momentul postării + fereastra (implicit 60 min). */
export function express60Deadline(
  createdAtIso: string,
  windowMinutes: number = EXPRESS_60_WINDOW_MINUTES
): Date {
  return new Date(new Date(createdAtIso).getTime() + windowMinutes * 60_000);
}

/** Minute rămase până la termenul-limită (0 dacă a trecut). */
export function express60MinutesLeft(deadlineIso: string, now: Date = new Date()): number {
  const diffMs = new Date(deadlineIso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 60_000));
}

/**
 * Marchează garanția ca respectată când o firmă preia lucrarea. Se apelează
 * după acceptarea reușită. Idempotent: acționează doar dacă e încă 'pending'.
 */
export function markExpress60Met(db: Database, jobId: string): void {
  db.prepare(
    `UPDATE jobs SET express_60_status = 'met'
       WHERE id = ? AND express_60 = 1 AND express_60_status = 'pending'`
  ).run(jobId);
}

export interface Express60SweepResult {
  breached: string[];
}

/**
 * Trece prin lucrările Express 60 încă în așteptare al căror termen a expirat
 * și le retrogradează la express standard: scoate suplimentul din price_gross
 * (clientul nu mai e taxat premium-ul) și marchează garanția 'breached'.
 * Rulează dintr-un cron (vezi /api/cron/express60) — idempotent și tranzacțional.
 */
export function expireExpress60Guarantees(db: Database, now: Date = new Date()): Express60SweepResult {
  const due = db
    .prepare(
      `SELECT id, express_60_fee, price_gross FROM jobs
        WHERE express_60 = 1
          AND express_60_status = 'pending'
          AND status = 'waiting'
          AND express_60_deadline IS NOT NULL
          AND express_60_deadline < ?`
    )
    .all(now.toISOString()) as { id: string; express_60_fee: number; price_gross: number }[];

  const breached: string[] = [];
  const sweep = db.transaction(() => {
    for (const job of due) {
      const newPrice = Math.max(0, job.price_gross - (job.express_60_fee ?? 0));
      const changed = db
        .prepare(
          `UPDATE jobs
              SET express_60 = 0,
                  express_60_status = 'breached',
                  price_gross = ?
            WHERE id = ? AND express_60 = 1 AND express_60_status = 'pending' AND status = 'waiting'`
        )
        .run(newPrice, job.id);
      if (changed.changes === 1) breached.push(job.id);
    }
  });
  sweep();
  return { breached };
}
