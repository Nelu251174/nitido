import { db, newId } from "@/lib/db";
import { audit } from "./audit";

const leadHits = new Map<string, { n: number; t: number }>();

export function rateLimitLead(ip: string): boolean {
  const now = Date.now();
  const row = leadHits.get(ip);
  if (!row || now - row.t > 10 * 60 * 1000) {
    leadHits.set(ip, { n: 1, t: now });
    return true;
  }
  if (row.n >= 10) return false;
  row.n += 1;
  return true;
}

export function createLead(input: {
  kind: "client" | "partner";
  contact_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  payload: Record<string, unknown>;
}) {
  if (!input.contact_name.trim()) throw new Error("Numele este obligatoriu.");
  if (!input.contact_email && !input.contact_phone) {
    throw new Error("Completeaza telefon sau email.");
  }
  const id = newId("lead");
  db.prepare(
    `INSERT INTO pro_leads (id, kind, payload_json, contact_name, contact_email, contact_phone, city)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.kind,
    JSON.stringify(input.payload),
    input.contact_name.trim(),
    input.contact_email ?? null,
    input.contact_phone ?? null,
    input.city ?? null
  );
  audit(null, "pro_lead", id, "created", { kind: input.kind });
  return id;
}
