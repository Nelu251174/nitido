import { NextResponse } from "next/server";
import { getBrowserAccount } from "@/lib/browserAccount";

export async function GET() {
  return NextResponse.json(await getBrowserAccount(), {
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
