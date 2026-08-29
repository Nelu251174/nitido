import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { JobRow } from "@/lib/types";
import { isAdmin } from "@/lib/adminAuth";

// Panou minimal de administrare — spec secțiunea 3.3 / 8 (aprobare firme, rapoarte,
// monitorizare no-show). Nu e un admin complet (fără autentificare), doar o fereastră
// de verificare pentru acest MVP.
export async function GET(_req: NextRequest) {
  void _req;
  if (!(await isAdmin())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const jobs = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all() as JobRow[];
  const firms = db
    .prepare(
      `SELECT firms.id, users.name, firms.coverage_city, firms.cui, firms.rating_sum, firms.rating_count,
              firms.strikes_30d, firms.strikes_90d, firms.suspended_until, firms.verified
       FROM firms JOIN users ON users.id = firms.user_id`
    )
    .all() as { id: string; name: string; verified: number }[];
  const payments = db.prepare("SELECT id, job_id, amount_gross, commission_amount, amount_net, status, created_at FROM payments ORDER BY created_at DESC").all();

  // Statistici agregate — ca platforma să poată fi condusă din cifre reale,
  // nu doar liste brute. Nimic din ce nu poate fi calculat direct din datele
  // existente; niciun număr fals/estimat.
  const today = new Date().toISOString().slice(0, 10);
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const everAcceptedJobs = jobs.filter((j) =>
    ["accepted", "arrived", "completed", "no_show"].includes(j.status)
  );
  const noShowJobs = jobs.filter((j) => j.status === "no_show");
  const gmv = completedJobs.reduce((sum, j) => sum + j.price_gross, 0);

  const completedCountByFirm = new Map<string, number>();
  for (const j of completedJobs) {
    if (!j.accepted_firm_id) continue;
    completedCountByFirm.set(
      j.accepted_firm_id,
      (completedCountByFirm.get(j.accepted_firm_id) ?? 0) + 1
    );
  }
  const topFirms = firms
    .map((f) => ({ id: f.id, name: f.name, completedJobs: completedCountByFirm.get(f.id) ?? 0 }))
    .filter((f) => f.completedJobs > 0)
    .sort((a, b) => b.completedJobs - a.completedJobs)
    .slice(0, 5);

  const stats = {
    totalJobs: jobs.length,
    jobsToday: jobs.filter((j) => j.created_at.slice(0, 10) === today).length,
    completedJobs: completedJobs.length,
    gmv,
    avgOrderValue: completedJobs.length > 0 ? Math.round(gmv / completedJobs.length) : 0,
    noShowRatePct:
      everAcceptedJobs.length > 0
        ? Math.round((noShowJobs.length / everAcceptedJobs.length) * 1000) / 10
        : 0,
    verifiedFirms: firms.filter((f) => f.verified).length,
    totalFirms: firms.length,
    topFirms,
  };

  return NextResponse.json({ jobs, firms, payments, stats });
}
