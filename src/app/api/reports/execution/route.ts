import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { executionReport } from "@/lib/business";

// GET — raportul de execuție al clientului (lucrări finalizate + totaluri).
// ?month=YYYY-MM filtrează opțional după luna finalizării.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  }
  const month = new URL(req.url).searchParams.get("month");
  return NextResponse.json({ report: executionReport(db, user.id, month) });
}
