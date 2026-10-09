import { db } from "@/lib/db";
import { markNoShow } from "@/lib/noShow";
import { NO_SHOW_GRACE_MINUTES } from "@/lib/strikes";

/**
 * Detectare automată de no-show — spec secțiunea 5b: "La ora programată: firma
 * trebuie să bifeze 'Am ajuns'... Firma NU bifează în X minute (30-60) după ora
 * programată → sistem marchează automat 'posibil no-show'".
 *
 * În producție (Vercel sau alt hosting serverless), un proces long-running cu
 * `setInterval` NU e o soluție fiabilă — funcțiile serverless nu au un proces
 * persistent între cereri. Varianta corectă acolo e **Vercel Cron** (sau orice
 * scheduler extern) care apelează periodic `runNoShowScan`. Aici, în schimb,
 * rulăm scanner-ul in-process (via `src/instrumentation.ts`), suficient cât timp
 * serverul de dev/producție rulează continuu în acest workspace — ca MVP-ul să
 * demonstreze cap-coadă și partea de no-show, nu doar restul fluxului.
 */

const SCAN_INTERVAL_MS = 30_000;

export async function runNoShowScan(): Promise<number> {
  const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MINUTES * 60_000).toISOString();

  const candidates = db
    .prepare(
      `SELECT id FROM jobs
       WHERE status = 'accepted'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= ?
         AND arrived_confirmed_at IS NULL`
    )
    .all(cutoff) as { id: string }[];

  let flagged = 0;
  for (const { id } of candidates) {
    const result = await markNoShow(db, id, false);
    if (result.ok) flagged++;
  }
  return flagged;
}

declare global {
  var __nitidoNoShowInterval: ReturnType<typeof setInterval> | undefined;
}

export function startNoShowScheduler(): void {
  if (global.__nitidoNoShowInterval) return; // deja pornit (hot-reload dev)
  global.__nitidoNoShowInterval = setInterval(() => {
    runNoShowScan().catch((err) => {
      console.error("[no-show-scheduler] scanare eșuată:", err);
    });
  }, SCAN_INTERVAL_MS);
}
