import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markNoShow } from "@/lib/noShow";

/**
 * No-show — spec secțiunea 5b. Logica efectivă e în src/lib/noShow.ts (partajată cu
 * scanner-ul automat din src/lib/noShowScheduler.ts). Ruta rămâne utilă pentru
 * declanșare manuală/admin sau apel dintr-un scheduler extern (ex. Vercel Cron).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const repost = Boolean(body?.repost);

  const result = await markNoShow(db, id, repost);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ consequence: result.consequence, repostedJobId: result.repostedJobId });
}
