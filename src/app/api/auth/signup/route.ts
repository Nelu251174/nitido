import { NextRequest, NextResponse } from "next/server";
import { db, newId, getUserByEmail, getUserByReferralCode } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { toE164Romania } from "@/lib/sms";
import { isPlausibleCui, sanitizeCui, verifyCuiWithAnaf } from "@/lib/cui";
import { sanitizeCoverageCitiesInput } from "@/lib/text";
import { generateReferralCode, REFERRAL_BONUS_LEI } from "@/lib/referral";
import { consumeRateLimit, requestIp } from "@/lib/security";

// Înregistrare — spec secțiunea 4.1 (client) și secțiunea 4, punct 1 (firmă:
// "date firmă, zonă de acoperire, tipuri de lucrări acceptate").
//
// Telefonul e obligatoriu pentru ambele roluri — clientul primește SMS de
// "am ajuns" (vezi src/lib/sms.ts), iar firma trebuie să fie contactabilă
// direct de un client în caz de nevoie.
export async function POST(req: NextRequest) {
  if (!consumeRateLimit(`signup:${requestIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Prea multe conturi create. Încearcă mai târziu." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const { role, name, email, password, phone, cui, coverageCity, coverageCitiesExtra, referralCode } =
    body as {
      role: "client" | "firma";
      name: string;
      email: string;
      password: string;
      phone?: string;
      cui?: string;
      coverageCity?: string;
      coverageCitiesExtra?: string;
      referralCode?: string;
    };

  if (!role || !["client", "firma"].includes(role)) {
    return NextResponse.json({ error: "Rol invalid" }, { status: 400 });
  }
  if (!name || !email || !password || !phone) {
    return NextResponse.json(
      { error: "Nume, email, parolă și telefon sunt obligatorii" },
      { status: 400 }
    );
  }
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ error: "Parola trebuie să aibă minim 10 caractere, litere și cifre" }, { status: 400 });
  }
  const normalizedPhone = toE164Romania(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Număr de telefon invalid" }, { status: 400 });
  }
  if (role === "firma" && !coverageCity) {
    return NextResponse.json(
      { error: "Zona de acoperire e obligatorie pentru firme" },
      { status: 400 }
    );
  }

  // CUI real, verificat contra ANAF — spec secțiunea 8. Nu se mai acceptă orice
  // text/cifre la înregistrarea unei firme; vezi src/lib/cui.ts.
  let cuiVerification: Awaited<ReturnType<typeof verifyCuiWithAnaf>> | null = null;
  if (role === "firma") {
    if (!cui || !isPlausibleCui(cui)) {
      return NextResponse.json(
        { error: "CUI invalid — introdu codul unic de înregistrare al firmei (fără spații)" },
        { status: 400 }
      );
    }
    cuiVerification = await verifyCuiWithAnaf(cui);
    if (cuiVerification.status === "not_found") {
      return NextResponse.json(
        { error: "Acest CUI nu corespunde niciunei firme înregistrate la ANAF" },
        { status: 400 }
      );
    }
    if (cuiVerification.status === "dissolved") {
      return NextResponse.json(
        { error: `Firma "${cuiVerification.name}" apare radiată la ANAF — nu poate fi înregistrată` },
        { status: 400 }
      );
    }
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Există deja un cont cu acest email" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const userId = newId("user");

  // Program de recomandare — cod introdus opțional de un utilizator nou. Un
  // cod invalid/inexistent NU blochează înregistrarea, doar nu se acordă
  // bonusul (nu penalizăm un simplu typo). Vezi src/lib/referral.ts.
  const referrer = referralCode ? getUserByReferralCode(referralCode.trim().toUpperCase()) : undefined;
  const newUserCredit = referrer ? REFERRAL_BONUS_LEI : 0;

  let ownReferralCode = generateReferralCode(name);
  while (getUserByReferralCode(ownReferralCode)) {
    ownReferralCode = generateReferralCode(name);
  }

  db.prepare(
    `INSERT INTO users
      (id, role, name, email, phone, password_hash, referral_code, referred_by_code, credit_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    role,
    name,
    email,
    normalizedPhone,
    passwordHash,
    ownReferralCode,
    referrer ? referrer.referral_code : null,
    newUserCredit
  );

  if (referrer) {
    db.prepare("UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?").run(
      REFERRAL_BONUS_LEI,
      referrer.id
    );
  }

  if (role === "firma") {
    const firmId = newId("firm");
    // Verificată (verified=1) doar dacă ANAF a confirmat efectiv firma activă.
    // Dacă ANAF a fost indisponibil la momentul înregistrării (status
    // "unavailable"), firma intră neverificată (0) — vezi admin, secțiunea
    // firme, pentru revizuire manuală ulterioară.
    const verified = cuiVerification?.status === "valid" ? 1 : 0;
    const citiesExtra = coverageCitiesExtra ? sanitizeCoverageCitiesInput(coverageCitiesExtra) : null;
    db.prepare(
      "INSERT INTO firms (id, user_id, cui, coverage_city, coverage_cities_extra, verified) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(firmId, userId, sanitizeCui(cui!), coverageCity, citiesExtra || null, verified);
  }

  const sessionToken = await createSession(userId);

  return NextResponse.json({
    ok: true,
    role,
    ...(process.env.NITIDO_ENABLE_BEARER_AUTH === "true" ? { sessionToken } : {}),
  }, { status: 201 });
}
