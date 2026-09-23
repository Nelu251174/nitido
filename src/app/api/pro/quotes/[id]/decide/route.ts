import { NextRequest, NextResponse } from "next/server";
import "@/lib/pro/schema";
import { getCurrentUser } from "@/lib/auth";
import { decideQuote } from "@/lib/pro/quotes";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision === "rejected" ? "rejected" : body.decision === "approved" ? "approved" : null;
  if (!decision) return NextResponse.json({ error: "Decizie invalida" }, { status: 400 });
  const result = decideQuote(user.id, id, decision);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
