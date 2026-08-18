import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, role } = body as {
    email: string;
    password: string;
    role?: "client" | "firma";
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Email și parolă necesare" }, { status: 400 });
  }

  const user = getUserByEmail(email);
  if (!user || !user.password_hash) {
    return NextResponse.json({ error: "Email sau parolă incorecte" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Email sau parolă incorecte" }, { status: 401 });
  }

  // Validare tip de cont — dacă utilizatorul a selectat "Client" sau "Firmă" la
  // autentificare, contul trebuie să chiar fie de tipul respectiv.
  if (role && role !== user.role) {
    const correctLabel = user.role === "firma" ? "Firmă" : "Client";
    return NextResponse.json(
      { error: `Acest cont este de tip ${correctLabel}. Selectează "${correctLabel}" mai sus.` },
      { status: 409 }
    );
  }

  const sessionToken = await createSession(user.id);
  // sessionToken e util doar pentru aplicația mobilă (Bearer auth) — clientul
  // web ignoră câmpul, el a primit deja cookie-ul httpOnly din createSession.
  return NextResponse.json({ ok: true, role: user.role, sessionToken });
}
