import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyPasswordReset } from "@/lib/passwordReset";
import { hashPassword } from "@/lib/auth";
import { consumeRateLimit, requestIp, hasTrustedMutationOrigin } from "@/lib/security";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(req: NextRequest) {
  if (!hasTrustedMutationOrigin(req)) return reply({error:"Origine invalidă"},403);
  if (!consumeRateLimit(`reset:${requestIp(req)}`, 10, 15 * 60 * 1000)) {
    return reply({ error: "Prea multe încercări. Încearcă mai târziu." },429);
  }
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 2000) return reply({error:"Cerere prea mare"},413);
  let body;
  try { body=JSON.parse(raw); } catch { return reply({error:"Date invalide"},400); }
  if (!body || typeof body!=="object" || Array.isArray(body)) return reply({error:"Date invalide"},400);
  const { token, password } = body;
  if (typeof token!=="string" || !/^[a-f0-9]{64}$/.test(token) || typeof password!=="string") return reply({error:"Link sau parolă invalide"},400);
  if (password.length < 10 || Buffer.byteLength(password) > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return reply({ error: "Parola trebuie să aibă minim 10 caractere, litere și cifre și maximum 72 de octeți." },400);
  }
  try {
    // Hashing may yield; the token is rechecked only inside the final transaction.
    const hash = await hashPassword(password);
    if (!applyPasswordReset(db,token,hash)) return reply({error:"Link invalid sau expirat. Cere un link nou."},400);
    return reply({ok:true});
  } catch {
    return reply({error:"Nu am putut salva parola. Reîncearcă folosind același link."},503);
  }
}
