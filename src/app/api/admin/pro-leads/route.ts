import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import "@/lib/pro/schema";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const leads = db
    .prepare(
      `SELECT id, kind, contact_name, contact_email, contact_phone, city, status, payload_json, created_at
       FROM pro_leads ORDER BY created_at DESC LIMIT 200`
    )
    .all();
  return NextResponse.json({ leads });
}
