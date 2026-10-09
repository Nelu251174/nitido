import { NextRequest, NextResponse } from "next/server";
import { getBrowserAccount } from "@/lib/browserAccount";

/** Legacy account entry: validate the selected workspace and keep the public origin. */
export async function GET(req: NextRequest) {
  const { destination } = await getBrowserAccount(req.nextUrl.searchParams.get("spatiu"));
  // Relative Location stays on the public origin behind a reverse proxy.
  // req.url can contain the container's internal 0.0.0.0:3000 address.
  return new NextResponse(null, { status: 307, headers: {
    Location: destination,
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
  } });
}
