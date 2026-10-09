import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, getFirmByUserId, getUserByReferralCode } from "@/lib/db";
import { generateReferralCode } from "@/lib/referral";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ user: null });

  // Auto-completare pentru conturi create înainte de programul de recomandare
  // (nu aveau referral_code) — generat o singură dată, la prima cerere după update.
  let referralCode = user.referral_code;
  if (!referralCode) {
    referralCode = generateReferralCode(user.name);
    while (getUserByReferralCode(referralCode)) {
      referralCode = generateReferralCode(user.name);
    }
    db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(referralCode, user.id);
  }

  let firm: ReturnType<typeof getFirmByUserId> | null = null;
  if (user.role === "firma") {
    firm = getFirmByUserId(user.id) ?? null;
  }

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      referral_code: referralCode,
      credit_balance: user.credit_balance,
      ...(firm ? { firm } : {}),
    },
    firm,
  });
}
