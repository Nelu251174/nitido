import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { JobRow } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { clientCanReadJob, firmCanReadFullJob } from "@/lib/authorization";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  const { id } = await params;
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  if (!job) return NextResponse.json({ error: "Lucrare inexistentă" }, { status: 404 });

  const firm = user.role === "firma" ? getFirmByUserId(user.id) : null;
  const authorized =
    (user.role === "client" && clientCanReadJob(user.id, job)) ||
    (firm && firmCanReadFullJob(firm.id, job));
  if (!authorized) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

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
