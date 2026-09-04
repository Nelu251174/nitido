import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, getFirmByUserId } from "@/lib/db";
import { createConnectOnboardingLink } from "@/lib/stripeConnect";

/**
 * Pornește onboarding-ul Stripe Connect pentru firma autentificată.
 * Întoarce URL-ul găzduit de Stripe către care clientul redirecționează firma.
 * Dacă STRIPE_SECRET_KEY nu e setată în producție, întoarce 503 cu mesaj clar
 * (nu eroare opacă) — platforma merge mai departe pe stub-ul de plăți.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const firm = getFirmByUserId(user.id);
  if (!firm) {
    return NextResponse.json({ error: "Firmă negăsită" }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;

  try {
    const result = await createConnectOnboardingLink(db, firm.id, baseUrl);
    if (!result.configured) {
      return NextResponse.json(
        {
          error:
            "Plățile Stripe nu sunt încă activate pe platformă (lipsește STRIPE_SECRET_KEY).",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ url: result.url });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Nu s-a putut porni onboarding-ul Stripe: ${
          err instanceof Error ? err.message : "eroare necunoscută"
        }`,
      },
      { status: 502 }
    );
  }
}
