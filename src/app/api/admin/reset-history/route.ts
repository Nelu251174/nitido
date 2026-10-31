import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditAdminAction, isAdmin } from "@/lib/adminAuth";

/**
 * This removes all operational history, including payments and evidence.
 * It is available only to explicitly enabled, local automated test fixtures;
 * production and hosted sandboxes must never expose this destructive action.
 */
function isolatedTestReset(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "test" || process.env.NITIDO_HISTORY_RESET_TEST_MODE !== "true") return false;
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    return site.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname)
      && !site.username && !site.password && site.pathname === "/" && !site.search && !site.hash
      && new URL(req.url).origin === site.origin && req.headers.get("origin") === site.origin;
  } catch {
    return false;
  }
}

const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store" },
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return reply({ error: "Neautorizat" }, 401);
  if (!isolatedTestReset(req)) return reply({ error: "Resetarea globală este disponibilă numai în testele locale izolate." }, 403);
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return reply(
      { error: "Confirmarea explicită este obligatorie" },
      400
    );
  }

  const result = db.transaction(() => {
    const notificationsDeleted = db.prepare("DELETE FROM notification_outbox").run();
    db.prepare("DELETE FROM workflow_audit_log").run();
    const photosDeleted = db.prepare("DELETE FROM job_photos").run();
    const paymentsDeleted = db.prepare("DELETE FROM payments").run();
    db.prepare("DELETE FROM review_reports").run();
    db.prepare("DELETE FROM ratings").run();
    db.prepare("DELETE FROM strikes").run();
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
      notifications: notificationsDeleted.changes,
      demoFirmsRemoved: demoFirmUserIds.length,
    };
  })();

  auditAdminAction("history.reset", null, result);
  return reply({ ok: true, ...result });
}
