import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { getEstimatorOptions, updateEstimatorOption } from "@/lib/estimatorConfig";
import type { SpaceType } from "@/lib/pricing";

// GET — toate opțiunile estimatorului (pentru panoul de admin).
export async function GET(_req: NextRequest) {
  void _req;
  if (!(await isAdmin())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  return NextResponse.json({ options: getEstimatorOptions(db) });
}

// POST — adminul schimbă eticheta și/sau vizibilitatea unui tip.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const key = b?.key as SpaceType | undefined;
  if (!key) return NextResponse.json({ error: "Cheie lipsă" }, { status: 400 });
  const ok = updateEstimatorOption(db, key, {
    label: typeof b?.label === "string" ? b.label : undefined,
    enabled: typeof b?.enabled === "boolean" ? b.enabled : undefined,
  });
  if (!ok) return NextResponse.json({ error: "Tip inexistent" }, { status: 404 });
  return NextResponse.json({ options: getEstimatorOptions(db) });
}
