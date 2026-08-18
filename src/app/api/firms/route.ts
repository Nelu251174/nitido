import { NextResponse } from "next/server";
import { listFirms } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ firms: listFirms() });
}
