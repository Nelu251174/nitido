import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Golește tot istoricul de activitate al platformei — lucrări, poze de
 * lucrare, plăți — plus cele 3 firme + clientul demo inserate automat la
 * prima pornire (vezi seed-ul din src/lib/db.ts). NU șterge conturi reale
 * (clienți/firme înregistrate de-adevăratelea) — doar activitatea de test.
 *
 * Acțiune ireversibilă — protejată printr-un cuvânt de confirmare trimis
 * explicit din panoul de admin (nu se poate declanșa accidental).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "STERGE") {
    return NextResponse.json(
      { error: "Confirmare lipsă — trimite { confirm: 'STERGE' }" },
      { status: 400 }
    );
  }

  const result = db.transaction(() => {
    const photosDeleted = db.prepare("DELETE FROM job_photos").run();
    const paymentsDeleted = db.prepare("DELETE FROM payments").run();
    db.prepare("DELETE FROM ratings").run();
    const jobsCount = db.prepare("DELETE FROM jobs").run();

    // Firme + client demo, inserate automat la prima pornire — identificabile
    // precis după CUI-urile/ID-ul fix folosite doar de seed, niciodată de un
    // cont real (vezi src/lib/db.ts).
    const demoFirmUserIds = db
      .prepare("SELECT user_id FROM firms WHERE cui IN ('RO11111111','RO22222222','RO33333333')")
      .all() as { user_id: string }[];
    db.prepare("DELETE FROM firms WHERE cui IN ('RO11111111','RO22222222','RO33333333')").run();
    for (const { user_id } of demoFirmUserIds) {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user_id);
      db.prepare("DELETE FROM users WHERE id = ?").run(user_id);
    }
    db.prepare("DELETE FROM sessions WHERE user_id = 'user_demo_client'").run();
    db.prepare("DELETE FROM users WHERE id = 'user_demo_client'").run();

    // Ratinguri/strike-uri erau calculate din lucrările tocmai șterse —
    // rămân firmele reale, dar cu un istoric curat.
    db.prepare(
      `UPDATE firms SET rating_sum = 0, rating_count = 0, strikes_30d = 0, strikes_90d = 0,
              suspended_until = NULL`
    ).run();

    return {
      jobs: jobsCount.changes,
      payments: paymentsDeleted.changes,
      photos: photosDeleted.changes,
      demoFirmsRemoved: demoFirmUserIds.length,
    };
  })();

  return NextResponse.json({ ok: true, ...result });
}
