import { NextRequest, NextResponse } from "next/server";
import { getBrowserAccount } from "@/lib/browserAccount";

/** Public account entry: validate sessions anew, with ADMIN taking precedence. */
export async function GET(req: NextRequest) {
  const { destination } = await getBrowserAccount();
  const response = NextResponse.redirect(new URL(destination, req.url), 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
