import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { JobRow } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  if (!job) return NextResponse.json({ error: "Lucrare inexistentă" }, { status: 404 });

  let firmName: string | null = null;
  if (job.accepted_firm_id) {
    const firm = db
      .prepare(
        `SELECT users.name as name FROM firms JOIN users ON users.id = firms.user_id WHERE firms.id = ?`
      )
      .get(job.accepted_firm_id) as { name: string } | undefined;
    firmName = firm?.name ?? null;
  }

  return NextResponse.json({ job, firmName });
}
