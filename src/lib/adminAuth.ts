import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, newId } from "@/lib/db";
import { constantTimeEqual, secureToken, tokenHash } from "@/lib/security";

const ADMIN_COOKIE = "nitido_admin_session";
const ADMIN_SESSION_HOURS = 8;

export function adminAuthConfigured(): boolean {
  return Boolean(process.env.NITIDO_ADMIN_EMAIL && process.env.NITIDO_ADMIN_PASSWORD_HASH);
}

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const configuredEmail = process.env.NITIDO_ADMIN_EMAIL;
  const configuredHash = process.env.NITIDO_ADMIN_PASSWORD_HASH;
  if (!configuredEmail || !configuredHash) return false;
  const emailMatches = constantTimeEqual(email.trim().toLowerCase(), configuredEmail.trim().toLowerCase());
  const passwordMatches = await bcrypt.compare(password, configuredHash).catch(() => false);
  return emailMatches && passwordMatches;
}

export async function createAdminSession(): Promise<void> {
  const token = secureToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000);
  db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(new Date().toISOString());
  db.prepare("INSERT INTO admin_sessions (id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(newId("adminsess"), tokenHash(token), expiresAt.toISOString());
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function isAdmin(): Promise<boolean> {
  if (!adminAuthConfigured()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const row = db.prepare("SELECT expires_at FROM admin_sessions WHERE token_hash = ?").get(tokenHash(token)) as
    | { expires_at: string }
    | undefined;
  if (!row || new Date(row.expires_at) <= new Date()) {
    if (row) db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash(token));
    return false;
  }
  return true;
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash(token));
  jar.delete(ADMIN_COOKIE);
}

export function auditAdminAction(action: string, targetId: string | null, details: object = {}): void {
  db.prepare("INSERT INTO admin_audit_log (id, action, target_id, details) VALUES (?, ?, ?, ?)")
    .run(newId("audit"), action, targetId, JSON.stringify(details));
}
