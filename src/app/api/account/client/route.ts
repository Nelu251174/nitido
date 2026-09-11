import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, getUserByEmail } from "@/lib/db";
import { toE164Romania } from "@/lib/sms";

// Profilul contului de client — citire și editare a datelor de bază (nume,
// email, telefon). Parola se schimbă separat (prin „Am uitat parola").

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const row = db.prepare("SELECT phone FROM users WHERE id = ?").get(user.id) as { phone: string | null } | undefined;
  return NextResponse.json({
    name: user.name,
    email: user.email,
    phone: row?.phone ?? "",
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; phone?: string };

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!name) {
    return NextResponse.json({ error: "Numele este obligatoriu" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalid" }, { status: 400 });
  }
  const normalizedPhone = toE164Romania(body.phone ?? "");
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Număr de telefon invalid" }, { status: 400 });
  }
  // Emailul trebuie să rămână unic — dacă e folosit de alt cont, refuzăm.
  const existing = getUserByEmail(email);
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "Există deja un cont cu acest email" }, { status: 409 });
  }

  db.prepare("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?").run(name, email, normalizedPhone, user.id);

  return NextResponse.json({ ok: true, name, email, phone: normalizedPhone });
}
