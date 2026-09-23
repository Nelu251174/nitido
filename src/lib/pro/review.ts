import { db, newId } from "@/lib/db";
import { audit } from "./audit";

const LEAD_STATUSES = ["new", "in_review", "qualified", "rejected"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function setLeadStatus(leadId: string, status: LeadStatus, note: string, actor: string | null) {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Status invalid.");
  const lead = db.prepare("SELECT id, kind, status FROM pro_leads WHERE id = ?").get(leadId) as { id: string; kind: string; status: string } | undefined;
  if (!lead) throw new Error("Cererea nu există.");
  db.prepare(`UPDATE pro_leads SET status = ?, reviewed_at = datetime('now'), review_note = ? WHERE id = ?`).run(status, note || null, leadId);
  audit(actor, "pro_lead", leadId, "status_changed", { from: lead.status, to: status, note });
  return { ...lead, status };
}

export function activatePartnerFromLead(leadId: string, actor: string | null) {
  const lead = db.prepare("SELECT * FROM pro_leads WHERE id = ?").get(leadId) as {
    id: string; kind: string; contact_name: string; contact_email: string | null; contact_phone: string | null; city: string | null; payload_json: string; status: string;
  } | undefined;
  if (!lead) throw new Error("Cererea nu există.");
  if (lead.kind !== "partner") throw new Error("Doar o cerere de partener poate fi activată.");
  const existing = db.prepare("SELECT id FROM pro_partners WHERE display_name = ? AND contact_email IS ?").get(lead.contact_name, lead.contact_email) as { id: string } | undefined;
  if (existing) {
    setLeadStatus(leadId, "qualified", `partener existent ${existing.id}`, actor);
    return { partnerId: existing.id, created: false };
  }
  const payload = safeJson(lead.payload_json);
  const partnerId = newId("ppar");
  db.prepare(`INSERT INTO pro_partners (id, display_name, service_types, coverage_areas, experience_notes, contact_email, contact_phone, capacity_notes, status, activated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'candidate', datetime('now'))`).run(
    partnerId,
    lead.contact_name,
    JSON.stringify(payload.services ?? []),
    JSON.stringify(payload.zones ?? lead.city ?? ""),
    String(payload.experience ?? ""),
    lead.contact_email,
    lead.contact_phone,
    String(payload.capacity ?? ""),
  );
  setLeadStatus(leadId, "qualified", `activare condiționată partner ${partnerId}`, actor);
  audit(actor, "pro_partner", partnerId, "created_from_lead", { leadId });
  return { partnerId, created: true };
}

function safeJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}
