import { NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/adminAuth";

export async function POST() {
  await destroyAdminSession();
  return NextResponse.json({ ok: true });
}
