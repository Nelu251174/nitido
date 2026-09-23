import { NextRequest, NextResponse } from "next/server";
import "@/lib/pro/schema";
import { getCurrentUser } from "@/lib/auth";
import { overrideQuote } from "@/lib/pro/quotes";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const result = overrideQuote(user.id, id, String(body.reason ?? ""));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
