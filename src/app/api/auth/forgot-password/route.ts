import { NextRequest, NextResponse } from "next/server";
import { db, getUserByEmail } from "@/lib/db";
import { createResetToken } from "@/lib/passwordReset";
import { sendEmail } from "@/lib/email";
import { consumeRateLimit, requestIp } from "@/lib/security";

// Răspuns generic mereu — nu dezvăluim dacă un email există sau nu (anti-enumerare).
const GENERIC = {
  ok: true,
  message: "Dacă există un cont cu acest email, ți-am trimis un link de resetare.",
};

export async function POST(req: NextRequest) {
  if (!consumeRateLimit(`forgot:${requestIp(req)}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Prea multe încercări. Încearcă mai târziu." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const email = (body?.email as string | undefined)?.trim();
  if (!email) return NextResponse.json({ error: "Email necesar" }, { status: 400 });

  const user = getUserByEmail(email);
  if (user?.email) {
    const raw = createResetToken(db, user.id);
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    const link = `${base}/reset-parola?token=${raw}`;
    await sendEmail({
      to: user.email,
      subject: "Resetare parolă — NITIDO.RO",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#101711">
          <h2 style="color:#101711">Resetare parolă</h2>
          <p>Ai cerut resetarea parolei pentru contul tău NITIDO.RO.</p>
          <p><a href="${link}" style="display:inline-block;background:#1b8a4c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Setează o parolă nouă</a></p>
          <p style="color:#5c6660;font-size:13px">Linkul e valabil 1 oră. Dacă nu tu ai cerut resetarea, ignoră acest email.</p>
        </div>`,
    }).catch(() => {});
  }
  return NextResponse.json(GENERIC);
}
