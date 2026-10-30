import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { consumeRateLimit, requestIp } from "@/lib/security";

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const temporaryCodes=new Set(['SQLITE_BUSY','SQLITE_LOCKED']);
export async function POST(req: NextRequest) {
 try {
  if (!consumeRateLimit(`login:${requestIp(req)}`, 10, 15 * 60 * 1000)) {
    return reply({ error: "Prea multe încercări. Încearcă mai târziu." },429);
  }
  const body:unknown = await req.json().catch(() => null);
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:"Email și parolă necesare"},400);
  const fields=body as Record<string,unknown>;
  if(typeof fields.email!=='string'||!fields.email.trim()||fields.email.length>254||typeof fields.password!=='string'||!fields.password||fields.password.length>1024||(fields.role!==undefined&&fields.role!=='client'&&fields.role!=='firma'))return reply({error:"Email și parolă necesare"},400);
  const email=fields.email.trim(),password=fields.password,role=fields.role;

  const user = getUserByEmail(email);
  if (!user || !user.password_hash) {
    return reply({ error: "Email sau parolă incorecte" },401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return reply({ error: "Email sau parolă incorecte" },401);
  }

  // Validare tip de cont — dacă utilizatorul a selectat "Client" sau "Firmă" la
  // autentificare, contul trebuie să chiar fie de tipul respectiv.
  if (role && role !== user.role) {
    const correctLabel = user.role === "firma" ? "Firmă" : "Client";
    return reply(
      { error: `Acest cont este de tip ${correctLabel}. Selectează "${correctLabel}" mai sus.` },
      409
    );
  }

  let sessionToken:string;
  try { sessionToken=await createSession(user.id); }
  catch(error) {
    const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
    if(!temporaryCodes.has(code))throw error;
    await new Promise(resolve=>setTimeout(resolve,250));
    sessionToken=await createSession(user.id);
  }
  return reply({
    ok: true,
    role: user.role,
    ...(process.env.NITIDO_ENABLE_BEARER_AUTH === "true" ? { sessionToken } : {}),
  });
 } catch(error) {
   const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
   console.error('[auth-login]',new Set(['SQLITE_BUSY','SQLITE_LOCKED','SQLITE_READONLY','SQLITE_FULL','SQLITE_CORRUPT']).has(code)?code:'AUTH_UNAVAILABLE');
   return reply({error:'Conexiunea nu permite verificarea contului. Reîncearcă.',code:'AUTH_UNAVAILABLE'},503);
 }
}
