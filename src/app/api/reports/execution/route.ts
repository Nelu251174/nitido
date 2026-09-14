import {executionCsv,validReportMonth} from "@/lib/executionCsv";
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
  const params = new URL(req.url).searchParams;
  const month = params.get("month");
  if (month !== null && !validReportMonth(month)) return NextResponse.json({error:"Luna trebuie să fie în format YYYY-MM."},{status:400});
  const report = executionReport(db, user.id, month);
  const headers = {"Cache-Control":"private, no-store"};
  if (params.get("format") === "csv") return new NextResponse(executionCsv(report), {headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="nitido-executie-${month??'toate'}.csv"`}});
  return NextResponse.json({ report }, {headers});
}
