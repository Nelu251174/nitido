import { NextRequest, NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import path from "path";
import fs from "fs";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit, requestIp } from "@/lib/security";

// Upload real de poze la postarea lucrării — spec secțiunea 3, punct 2:
// "Clientul poate încărca 1-5 poze cu spațiul de curățat."
//
// Stocare pe disk local (public/uploads), suficientă pentru acest MVP.
// În producție ai nevoie de stocare persistentă (S3/Cloudinary) — vezi README.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

function detectedImageType(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return { mime: "image/gif", ext: "gif" };
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  if (!consumeRateLimit(`upload:${user.id}:${requestIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Prea multe încărcări" }, { status: 429 });
  }
  const stale = db.prepare(
    "SELECT id, filename FROM job_photos WHERE job_id IS NULL AND created_at < datetime('now', '-24 hours')"
  ).all() as { id: string; filename: string }[];
  for (const photo of stale) {
    if (path.basename(photo.filename) === photo.filename) {
      fs.rmSync(path.join(UPLOAD_DIR, photo.filename), { force: true });
    }
    db.prepare("DELETE FROM job_photos WHERE id = ? AND job_id IS NULL").run(photo.id);
  }
  const orphanCount = db.prepare(
    "SELECT COUNT(*) AS count FROM job_photos WHERE owner_user_id = ? AND job_id IS NULL"
  ).get(user.id) as { count: number };
  if (orphanCount.count >= 10) {
    return NextResponse.json({ error: "Atașează sau elimină pozele încărcate înainte de altele noi" }, { status: 429 });
  }
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Niciun fișier primit" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tip de fișier neacceptat" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Fișier prea mare (max 8MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectedImageType(buffer);
  if (!detected || detected.mime !== file.type) {
    return NextResponse.json({ error: "Conținutul fișierului nu corespunde unui format permis" }, { status: 400 });
  }
  const ext = detected.ext;
  const id = newId("photo");
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

  // job_id rămâne NULL până la crearea lucrării (POST /api/jobs îl leagă apoi).
  db.prepare("INSERT INTO job_photos (id, job_id, owner_user_id, filename) VALUES (?, NULL, ?, ?)").run(
    id,
    user.id,
    filename
  );

  return NextResponse.json({ id, url: `/api/uploads/${id}` }, { status: 201 });
}
