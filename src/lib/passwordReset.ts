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

/** Consume the link, change the password and revoke sessions as one operation. */
export function applyPasswordReset(db: Database, rawToken: string, passwordHash: string): boolean {
  return db.transaction(() => {
    const row = db.prepare("SELECT id,user_id,expires_at,used_at FROM password_reset_tokens WHERE token_hash=?")
      .get(hashToken(rawToken)) as {id:string;user_id:string;expires_at:string;used_at:string|null}|undefined;
    if (!row || row.used_at || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now()) return false;
    const changed = db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(passwordHash,row.user_id);
    if (changed.changes !== 1) return false;
    // Every older outstanding link loses authority after a successful reset.
    db.prepare("UPDATE password_reset_tokens SET used_at=datetime('now') WHERE user_id=? AND used_at IS NULL").run(row.user_id);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(row.user_id);
    return true;
  })();
}

/** Remove only the failed delivery attempt; preserve other issued links. */
export function discardResetToken(db: Database, rawToken: string): void {
  db.prepare("DELETE FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL").run(hashToken(rawToken));
}
