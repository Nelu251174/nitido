import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { getCurrentUser } from "@/lib/auth";

/** Public account entry: validate sessions anew, with ADMIN taking precedence. */
export async function GET(req: NextRequest) {
  let destination: string;
  if (await isAdmin()) {
    destination = "/admin";
  } else {
    // This is browser navigation; do not use a supplied bearer or query role.
    const user = await getCurrentUser();
    destination = user?.role === "firma" ? "/firma" : user?.role === "client" ? "/client" : "/login";
  }
  const response = NextResponse.redirect(new URL(destination, req.url), 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
