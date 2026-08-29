import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId, getUserById } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { acceptJobAtomic } from "@/lib/acceptJob";
import { sendJobAcceptedSms } from "@/lib/sms";
import { JobRow } from "@/lib/types";

/**
 * Mecanismul central al platformei — primul care apasă câștigă.
 * IMPORTANT: identitatea firmei se derivă exclusiv din sesiunea autentificată.
 * Nu acceptăm firmId din request body, pentru a preveni acceptarea unei lucrări
 * în numele altei firme.
 */
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
  const result = await acceptJobAtomic(db, id, firm.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.status === 409 ? "ALREADY_TAKEN" : "ACCEPT_FAILED" },
      { status: result.status }
    );
  }

  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;

  const firmForSms = db
    .prepare(`SELECT u.name FROM firms f JOIN users u ON u.id = f.user_id WHERE f.id = ?`)
    .get(firm.id) as { name: string } | undefined;
  const clientForSms = getUserById(updated.client_id);
  sendJobAcceptedSms({
    clientPhone: clientForSms?.phone ?? null,
    firmName: firmForSms?.name ?? "O firmă",
    street: updated.street,
    city: updated.city,
  }).catch(() => {});

  return NextResponse.json({ job: updated });
}
