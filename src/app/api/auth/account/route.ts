import { NextRequest, NextResponse } from "next/server";
import { getBrowserAccount } from "@/lib/browserAccount";

export async function GET(req: NextRequest) {
  return NextResponse.json(await getBrowserAccount(req.nextUrl.searchParams.get("spatiu")), {
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
