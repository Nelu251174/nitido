import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId, getUserById } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendArrivalSms } from "@/lib/sms";
import { JobRow } from "@/lib/types";

// Confirmare sosire — permisă numai firmei autentificate care a acceptat lucrarea.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca firmă" }, { status: 401 });
  }

  const firm = getFirmByUserId(user.id);
  if (!firm) {
    return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
  }

  const { id } = await params;
  const result = db
    .prepare(
      `UPDATE jobs SET status = 'arrived', arrived_confirmed_at = datetime('now')
       WHERE id = ? AND status = 'accepted' AND accepted_firm_id = ?`
    )
    .run(id, firm.id);

  if (result.changes === 0) {
    return NextResponse.json(
      { error: "Lucrarea nu poate fi confirmată de această firmă" },
      { status: 409 }
    );
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;
  const clientUser = getUserById(job.client_id);
  sendArrivalSms({
    clientPhone: clientUser?.phone ?? null,
    firmName: user.name,
    street: job.street,
    city: job.city,
  }).catch(() => {});

  return NextResponse.json({ job });
}
