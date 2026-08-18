import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Statistici publice, reale — folosite pe homepage ca dovadă socială (spec
 * inspirată din Helpling/HomeRun, care afișează cifre reale de platformă).
 * DELIBERAT nu inventăm nimic aici — dacă platforma e la început și cifrele
 * sunt mici/zero, homepage-ul ascunde secțiunea (vezi src/app/page.tsx) în
 * loc să arate un "0" care pare rupt sau un număr fals care ar fi o minciună.
 */
export async function GET() {
  const completedJobs = db
    .prepare("SELECT COUNT(*) as n FROM jobs WHERE status = 'completed'")
    .get() as { n: number };

  const firmStats = db
    .prepare(
      `SELECT COUNT(*) as verifiedFirms,
              COALESCE(SUM(rating_sum), 0) as ratingSum,
              COALESCE(SUM(rating_count), 0) as ratingCount
       FROM firms WHERE verified = 1`
    )
    .get() as { verifiedFirms: number; ratingSum: number; ratingCount: number };

  const avgRating = firmStats.ratingCount > 0 ? firmStats.ratingSum / firmStats.ratingCount : null;

  return NextResponse.json({
    completedJobs: completedJobs.n,
    verifiedFirms: firmStats.verifiedFirms,
    avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
    ratingCount: firmStats.ratingCount,
  });
}
