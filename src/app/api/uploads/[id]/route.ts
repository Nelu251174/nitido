import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, getFirmByUserId } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  const admin = await isAdmin();
  if (!user && !admin) return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });

  const { id } = await params;
  const photo = db.prepare(
    `SELECT p.filename, p.owner_user_id, j.client_id, j.accepted_firm_id
     FROM job_photos p LEFT JOIN jobs j ON j.id = p.job_id WHERE p.id = ?`
  ).get(id) as
    | { filename: string; owner_user_id: string | null; client_id: string | null; accepted_firm_id: string | null }
    | undefined;
  if (!photo) return NextResponse.json({ error: "Imagine inexistentă" }, { status: 404 });

  const firm = user?.role === "firma" ? getFirmByUserId(user.id) : null;
  const authorized =
    admin ||
    (user?.role === "client" && (photo.owner_user_id === user.id || photo.client_id === user.id)) ||
    Boolean(firm && photo.accepted_firm_id === firm.id);
  if (!authorized) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  if (path.basename(photo.filename) !== photo.filename) {
    return NextResponse.json({ error: "Imagine invalidă" }, { status: 400 });
  }
  const filePath = path.join(UPLOAD_DIR, photo.filename);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Imagine indisponibilă" }, { status: 404 });
  const contentType = CONTENT_TYPES[path.extname(photo.filename).toLowerCase()];
  if (!contentType) return NextResponse.json({ error: "Format invalid" }, { status: 400 });

  return new NextResponse(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
