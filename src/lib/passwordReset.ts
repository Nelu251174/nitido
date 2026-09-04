import crypto from "crypto";
import type { Database } from "better-sqlite3";
import { newId } from "@/lib/db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 oră

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creează un token de resetare (se stochează DOAR hash-ul) și întoarce valoarea brută. */
export function createResetToken(db: Database, userId: string): string {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)"
  ).run(newId("prt"), userId, hashToken(raw), expiresAt);
  return raw;
}

/** Validează și consumă (marchează folosit) un token. Întoarce user_id sau null. */
export function consumeResetToken(db: Database, rawToken: string): string | null {
  const row = db
    .prepare("SELECT id,user_id,expires_at,used_at FROM password_reset_tokens WHERE token_hash=?")
    .get(hashToken(rawToken)) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return null;
  db.prepare("UPDATE password_reset_tokens SET used_at=datetime('now') WHERE id=?").run(row.id);
  return row.user_id;
}
