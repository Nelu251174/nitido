import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requestReclean } from "@/lib/guarantee";
import { JobRow } from "@/lib/types";

// POST — clientul cere re-curățarea gratuită (Nitido Guaranteed) pentru o
// lucrare finalizată, în fereastra de garanție.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  const { id } = await params;
  const result = requestReclean(db, id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(result.jobId) as JobRow;
  return NextResponse.json({ job });
}
