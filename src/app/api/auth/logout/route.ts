import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await destroySession(req);
  return NextResponse.json({ ok: true });
}
