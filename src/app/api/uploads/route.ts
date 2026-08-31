import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId, newId } from "@/lib/db";
import path from "path";
import fs from "fs";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit, requestIp } from "@/lib/security";
import { auditWorkflow, WorkProofType } from "@/lib/proofOfWork";

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
  if (!user) return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
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
  const orphanCount = user.role === "client" ? db.prepare(
    "SELECT COUNT(*) AS count FROM job_photos WHERE owner_user_id = ? AND job_id IS NULL"
  ).get(user.id) as { count: number } : { count: 0 };
  if (orphanCount.count >= 10) {
    return NextResponse.json({ error: "Atașează sau elimină pozele încărcate înainte de altele noi" }, { status: 429 });
  }
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const formData = await req.formData();
  const file = formData.get("file");
  const jobId = String(formData.get("jobId") ?? "");
  const proofType = String(formData.get("proofType") ?? "").toUpperCase() as WorkProofType;

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

  if (user.role === "firma") {
    const firm = getFirmByUserId(user.id);
    if (!firm) return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
    if (!jobId || !["ARRIVAL", "COMPLETION"].includes(proofType)) {
      return NextResponse.json({ error: "Lucrarea și tipul dovezii sunt obligatorii" }, { status: 400 });
    }
    const job = db.prepare("SELECT status,accepted_firm_id FROM jobs WHERE id=?").get(jobId) as {status:string;accepted_firm_id:string|null}|undefined;
    const validState = proofType === "ARRIVAL" ? job?.status === "accepted" : job?.status === "arrived";
    if (!job || job.accepted_firm_id !== firm.id || !validState) {
      return NextResponse.json({ error: "Nu poți atașa această dovadă lucrării" }, { status: 403 });
    }
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    db.prepare(`INSERT INTO job_photos
      (id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at)
      VALUES (?,?,?,?,?,?,?,?, 'VALID',datetime('now'))`).run(id, jobId, user.id, firm.id, proofType, filename, detected.mime, file.size);
    auditWorkflow(db, `${proofType}_PROOF_UPLOADED`, jobId, firm.id, user.id, { proofId: id, mimeType: detected.mime, fileSize: file.size });
    return NextResponse.json({ id, url: `/api/uploads/${id}`, proofType }, { status: 201 });
  }

  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

  // job_id rămâne NULL până la crearea lucrării (POST /api/jobs îl leagă apoi).
  db.prepare("INSERT INTO job_photos (id, job_id, owner_user_id, proof_type, filename, mime_type, file_size, status, validated_at) VALUES (?, NULL, ?, 'CLIENT_CONTEXT', ?, ?, ?, 'VALID', datetime('now'))").run(
    id,
    user.id,
    filename,
    detected.mime,
    file.size
  );

  return NextResponse.json({ id, url: `/api/uploads/${id}` }, { status: 201 });
}
