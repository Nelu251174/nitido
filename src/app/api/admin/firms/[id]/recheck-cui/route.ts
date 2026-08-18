import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCuiWithAnaf } from "@/lib/cui";

/**
 * Re-verificare manuală a unei firme contra ANAF — pentru cazul în care
 * verificarea automată de la înregistrare a picat pe "unavailable" (ANAF
 * indisponibil chiar în acel moment) și firma a rămas neverificată fără
 * nicio acțiune ulterioară posibilă. Nu există "cine bifează verificat" —
 * verificarea e mereu automată, contra ANAF; acest buton doar reia
 * verificarea, nu o forțează manual (o firmă cu CUI invalid/inventat tot
 * nu va trece, exact ca la înregistrare).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const firm = db.prepare("SELECT id, cui FROM firms WHERE id = ?").get(id) as
    | { id: string; cui: string | null }
    | undefined;

  if (!firm) {
    return NextResponse.json({ error: "Firmă inexistentă" }, { status: 404 });
  }
  if (!firm.cui) {
    return NextResponse.json({ error: "Firma nu are CUI salvat" }, { status: 400 });
  }

  const result = await verifyCuiWithAnaf(firm.cui);

  if (result.status === "valid") {
    db.prepare("UPDATE firms SET verified = 1 WHERE id = ?").run(id);
    return NextResponse.json({ verified: true, status: result.status, name: result.name });
  }

  if (result.status === "not_found") {
    return NextResponse.json({
      verified: false,
      status: result.status,
      message: "CUI-ul nu corespunde niciunei firme la ANAF",
    });
  }
  if (result.status === "dissolved") {
    return NextResponse.json({
      verified: false,
      status: result.status,
      message: `Firma "${result.name}" apare radiată la ANAF`,
    });
  }

  return NextResponse.json({
    verified: false,
    status: result.status,
    message: "ANAF indisponibil chiar acum — încearcă din nou peste câteva minute",
  });
}
