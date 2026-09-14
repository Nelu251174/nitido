import {profileInputError} from "@/lib/profileInput";
import {hasTrustedMutationOrigin,consumeRateLimit} from "@/lib/security";
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
    description: firm?.description ?? "",
    workingHours: firm?.working_hours ?? "",
    services: firm?.services ?? "",
    website: firm?.website ?? "",
  });
}

/** Salvează modificările profilului firmei. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:"Origine invalidă"},{status:403});
  if(!consumeRateLimit(`profile:${user.id}`,20,60000))return NextResponse.json({error:"Prea multe modificări. Reîncearcă într-un minut."},{status:429});
  const raw=await req.text();if(Buffer.byteLength(raw)>12000)return NextResponse.json({error:"Cerere prea mare"},{status:413});
  let parsed;try{parsed=JSON.parse(raw)}catch{return NextResponse.json({error:"Date invalide"},{status:400})}
  const inputError=profileInputError(parsed,true);
  if(inputError)return NextResponse.json({error:inputError},{status:400});
  const body=parsed as {
    name?: string;
    phone?: string;
    coverageCity?: string;
    coverageCitiesExtra?: string;
    description?: string;
    workingHours?: string;
    services?: string;
    website?: string;
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

  // Câmpuri text libere, limitate ca lungime pentru a evita abuzul.
  const description = (body.description ?? "").trim().slice(0, 1000) || null;
  const workingHours = (body.workingHours ?? "").trim().slice(0, 200) || null;
  const services = (body.services ?? "").trim().slice(0, 400) || null;
  let website = (body.website ?? "").trim().slice(0, 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  const websiteValue = website || null;

  const exists=getFirmByUserId(user.id);
  if(!exists)return NextResponse.json({error:"Profil de firmă inexistent"},{status:404});
  db.transaction(()=>{
  db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, normalizedPhone, user.id);
  db.prepare(
    "UPDATE firms SET coverage_city = ?, coverage_cities_extra = ?, description = ?, working_hours = ?, services = ?, website = ? WHERE user_id = ?"
  ).run(coverageCity, citiesExtra || null, description, workingHours, services, websiteValue, user.id);
  })();

  return NextResponse.json({
    ok: true,
    name,
    phone: normalizedPhone,
    coverageCity,
    coverageCitiesExtra: citiesExtra || "",
    description: description || "",
    workingHours: workingHours || "",
    services: services || "",
    website: websiteValue || "",
  });
}
