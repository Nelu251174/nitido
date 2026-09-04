import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeResetToken } from "@/lib/passwordReset";
import { hashPassword } from "@/lib/auth";
import { consumeRateLimit, requestIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!consumeRateLimit(`reset:${requestIp(req)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Prea multe încercări. Încearcă mai târziu." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string | undefined;
  const password = body?.password as string | undefined;
  if (!token || !password) return NextResponse.json({ error: "Token și parolă necesare" }, { status: 400 });
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ error: "Parola trebuie să aibă minim 10 caractere, litere și cifre" }, { status: 400 });
  }

  const userId = consumeResetToken(db, token);
  if (!userId) return NextResponse.json({ error: "Link invalid sau expirat. Cere un link nou." }, { status: 400 });

  const hash = await hashPassword(password);
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, userId);
  // Din motive de securitate, invalidăm toate sesiunile active ale userului.
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  return NextResponse.json({ ok: true });
}
