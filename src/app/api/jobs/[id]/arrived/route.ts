import { NextRequest, NextResponse } from "next/server";
import { db, getUserById } from "@/lib/db";
import { sendArrivalSms } from "@/lib/sms";
import { JobRow } from "@/lib/types";

// Confirmare "Am ajuns / Lucrare începută" — spec secțiunea 4, punct 4.
// Bază pentru detectarea automată a no-show-ului (secțiunea 5b).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = db
    .prepare(
      `UPDATE jobs SET status = 'arrived', arrived_confirmed_at = datetime('now')
       WHERE id = ? AND status = 'accepted'`
    )
    .run(id);

  if (result.changes === 0) {
    return NextResponse.json(
      { error: "Lucrarea nu e în starea potrivită pentru confirmare de sosire" },
      { status: 409 }
    );
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;

  // SMS instant către client — "echipa a ajuns" (no-op dacă Twilio nu e configurat
  // sau clientul n-a lăsat telefon; nu blochează răspunsul dacă eșuează).
  const firm = job.accepted_firm_id
    ? (db
        .prepare(
          `SELECT u.name FROM firms f JOIN users u ON u.id = f.user_id WHERE f.id = ?`
        )
        .get(job.accepted_firm_id) as { name: string } | undefined)
    : undefined;
  const clientUser = getUserById(job.client_id);
  sendArrivalSms({
    clientPhone: clientUser?.phone ?? null,
    firmName: firm?.name ?? "Firma de curățenie",
    street: job.street,
    city: job.city,
  }).catch(() => {});

  return NextResponse.json({ job });
}
