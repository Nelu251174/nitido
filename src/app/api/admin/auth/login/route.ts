import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, verifyAdminCredentials } from "@/lib/adminAuth";
import { consumeRateLimit, requestIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!consumeRateLimit(`admin-login:${requestIp(req)}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Prea multe încercări" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  if (!(await verifyAdminCredentials(String(body.email ?? ""), String(body.password ?? "")))) {
    return NextResponse.json({ error: "Credențiale invalide" }, { status: 401 });
  }
  await createAdminSession();
  return NextResponse.json({ ok: true });
}
