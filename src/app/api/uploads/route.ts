import { NextRequest, NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import path from "path";
import fs from "fs";

// Upload real de poze la postarea lucrării — spec secțiunea 3, punct 2:
// "Clientul poate încărca 1-5 poze cu spațiul de curățat."
//
// Stocare pe disk local (public/uploads), suficientă pentru acest MVP.
// În producție ai nevoie de stocare persistentă (S3/Cloudinary) — vezi README.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
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

  const ext = file.type.split("/")[1] ?? "jpg";
  const id = newId("photo");
  const filename = `${id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

  // job_id rămâne NULL până la crearea lucrării (POST /api/jobs îl leagă apoi).
  db.prepare("INSERT INTO job_photos (id, job_id, filename) VALUES (?, NULL, ?)").run(
    id,
    filename
  );

  return NextResponse.json({ id, url: `/uploads/${filename}` }, { status: 201 });
}
