import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, auditAdminAction } from "@/lib/adminAuth";
import "@/lib/pro/schema";
import { activatePartnerFromLead, setLeadStatus, type LeadStatus } from "@/lib/pro/review";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const leads = db
    .prepare(
      `SELECT id, kind, contact_name, contact_email, contact_phone, city, status, payload_json, review_note, created_at
       FROM pro_leads ORDER BY created_at DESC LIMIT 200`
    )
    .all();
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  const note = String(body.note ?? "");
  if (!id) return NextResponse.json({ error: "ID lipsă" }, { status: 400 });
  try {
    if (action === "activate_partner") {
      const result = activatePartnerFromLead(id, null);
      auditAdminAction("PRO_PARTNER_ACTIVATE", id, result);
      return NextResponse.json({ ok: true, ...result });
    }
    if (["in_review", "qualified", "rejected"].includes(action)) {
      setLeadStatus(id, action as LeadStatus, note, null);
      auditAdminAction("PRO_LEAD_STATUS", id, { status: action, note });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acțiune invalidă" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare" }, { status: 400 });
  }
}
