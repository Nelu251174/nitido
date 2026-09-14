import { NextRequest, NextResponse } from "next/server";
import { db, getUserByEmail } from "@/lib/db";
import { createResetToken, discardResetToken } from "@/lib/passwordReset";
import { emailConfigured, sendEmail } from "@/lib/email";
import { consumeRateLimit, requestIp, hasTrustedMutationOrigin } from "@/lib/security";

// Same response for unknown accounts and delivery outcomes; no account enumeration.
const GENERIC = { ok: true, message: "Cererea a fost procesată. Dacă adresa corespunde unui cont și mesajul poate fi trimis, vei primi un link de resetare. Verifică Inbox și Spam. Livrarea nu este confirmată aici." };
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});

export async function POST(req: NextRequest) {
  if(!hasTrustedMutationOrigin(req))return reply({error:"Origine invalidă"},403);
  if (!consumeRateLimit(`forgot:${requestIp(req)}`, 5, 15 * 60 * 1000)) return reply({error:"Prea multe încercări. Încearcă mai târziu."},429);
  const rawBody=await req.text();
  if(Buffer.byteLength(rawBody)>2000)return reply({error:"Cerere prea mare"},413);
  let body;
  try{body=JSON.parse(rawBody)}catch{return reply({error:"Date invalide"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)||typeof body.email!=="string")return reply({error:"Email invalid"},400);
  const email=body.email.trim().toLowerCase();
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:"Email invalid"},400);
  // Configuration is checked equally for every address, before account lookup.
  let base:URL;
  try{
    base=new URL(process.env.NEXT_PUBLIC_SITE_URL??"");
    if(base.protocol!=="https:"||base.username||base.password||!emailConfigured())throw new Error();
  }catch{return reply({error:"Recuperarea prin email este temporar indisponibilă. Contactează suportul NITIDO."},503)}

  let token:string|undefined;
  try{
    const user=getUserByEmail(email);
    if(user?.email){
      token=createResetToken(db,user.id);
      const link=new URL('/reset-parola',base.origin);link.hash=token;
      const accepted=await sendEmail({to:user.email,subject:"Resetare parolă — NITIDO.RO",html:`<h2>Resetare parolă</h2><p>Ai cerut resetarea parolei pentru contul tău NITIDO.RO.</p><p><a href="${link.href}">Setează o parolă nouă</a></p><p>Linkul este valabil o oră. Dacă nu ai cerut resetarea, ignoră acest email.</p>`});
      if(!accepted)discardResetToken(db,token);
    }
  }catch{
    if(token){try{discardResetToken(db,token)}catch{/* Do not expose storage or delivery details. */}}
  }
  return reply(GENERIC);
}
