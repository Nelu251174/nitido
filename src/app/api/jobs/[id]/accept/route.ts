import { NextRequest, NextResponse } from "next/server";
import { db, getUserById } from "@/lib/db";
import { acceptJobAtomic } from "@/lib/acceptJob";
import { sendJobAcceptedSms } from "@/lib/sms";
import { JobRow } from "@/lib/types";

/**
 * Mecanismul central al platformei — spec secțiunea 5: "primul care apasă câștigă".
 * Logica atomică efectivă e în src/lib/acceptJob.ts (partajată cu testele).
 *
 * Notă tehnică (spec, secțiunea 5): trebuie mecanism de blocare la nivel de bază de
 * date ca să nu poată 2 firme accepta simultan aceeași lucrare. Aici se rezolvă cu un
 * UPDATE condiționat, atomic: `WHERE id = ? AND status = 'waiting'`. better-sqlite3
 * execută acest statement sincron — nu există fereastră în care alt request să se
 * strecoare între citire și scriere. Verificat live cu 3 firme lovind același job
 * simultan (vezi README) — exact una câștigă, celelalte primesc 409.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const firmId = body?.firmId as string | undefined;

  if (!firmId) {
    return NextResponse.json({ error: "firmId lipsă" }, { status: 400 });
  }

  const result = await acceptJobAtomic(db, id, firmId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: "ALREADY_TAKEN" }, { status: result.status });
  }

  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;

  // SMS instant către client — "firma X a acceptat lucrarea ta". Fire-and-forget,
  // nu blocăm răspunsul (același model ca la /arrived și la postarea unei lucrări noi).
  const firmForSms = db
    .prepare(`SELECT u.name FROM firms f JOIN users u ON u.id = f.user_id WHERE f.id = ?`)
    .get(firmId) as { name: string } | undefined;
  const clientForSms = getUserById(updated.client_id);
  sendJobAcceptedSms({
    clientPhone: clientForSms?.phone ?? null,
    firmName: firmForSms?.name ?? "O firmă",
    street: updated.street,
    city: updated.city,
  }).catch(() => {});

  return NextResponse.json({ job: updated });
}
