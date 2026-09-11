import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, getFirmByUserId } from "@/lib/db";
import { toE164Romania } from "@/lib/sms";
import { sanitizeCoverageCitiesInput } from "@/lib/text";

// Profilul firmei — citire și editare. CUI-ul (verificat la ANAF) NU se
// modifică de aici; se pot schimba: numele firmei, telefonul, orașul principal
// de acoperire și orașele suplimentare.

/** Datele curente ale profilului, pentru precompletarea formularului. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const firm = getFirmByUserId(user.id);
  const row = db.prepare("SELECT phone FROM users WHERE id = ?").get(user.id) as { phone: string | null } | undefined;
  return NextResponse.json({
    name: user.name,
    email: user.email,
    phone: row?.phone ?? "",
    coverageCity: firm?.coverage_city ?? "",
    coverageCitiesExtra: firm?.coverage_cities_extra ?? "",
  });
}

/** Salvează modificările profilului firmei. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    coverageCity?: string;
    coverageCitiesExtra?: string;
  };

  const name = (body.name ?? "").trim();
  const coverageCity = (body.coverageCity ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Numele firmei este obligatoriu" }, { status: 400 });
  }
  if (!coverageCity) {
    return NextResponse.json({ error: "Orașul de acoperire este obligatoriu" }, { status: 400 });
  }
  const normalizedPhone = toE164Romania(body.phone ?? "");
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Număr de telefon invalid" }, { status: 400 });
  }
  const citiesExtra = body.coverageCitiesExtra ? sanitizeCoverageCitiesInput(body.coverageCitiesExtra) : null;

  db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, normalizedPhone, user.id);
  db.prepare("UPDATE firms SET coverage_city = ?, coverage_cities_extra = ? WHERE user_id = ?").run(
    coverageCity,
    citiesExtra || null,
    user.id
  );

  return NextResponse.json({
    ok: true,
    name,
    phone: normalizedPhone,
    coverageCity,
    coverageCitiesExtra: citiesExtra || "",
  });
}
