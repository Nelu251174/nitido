import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db, getUserById, UserRow } from "@/lib/db";
import { secureToken } from "@/lib/security";

const SESSION_COOKIE = "nitido_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Creează o sesiune și o setează atât ca cookie httpOnly (pentru clientul web)
 * cât și returnează id-ul brut, ca rutele de login/signup să-l poată include
 * în răspunsul JSON pentru clientul mobil (React Native) — acolo nu există
 * cookie-jar automat ca în browser, așa că aplicația mobilă ține minte
 * sessionToken-ul singură (AsyncStorage) și îl trimite ca
 * `Authorization: Bearer <token>` pe fiecare cerere. Vezi getCurrentUser.
 */
export async function createSession(userId: string): Promise<string> {
  const id = secureToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    id,
    userId,
    expiresAt.toISOString()
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return id;
}

export async function destroySession(req?: NextRequest): Promise<void> {
  const bearerSessionId = getBearerSessionId(req);
  if (bearerSessionId) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(bearerSessionId);
  }

  const jar = await cookies();
  const cookieSessionId = jar.get(SESSION_COOKIE)?.value;
  if (cookieSessionId) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(cookieSessionId);
  }
  jar.delete(SESSION_COOKIE);
}

function getBearerSessionId(req?: NextRequest): string | null {
  if (process.env.NITIDO_ENABLE_BEARER_AUTH !== "true") return null;
  const authHeader = req?.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return null;
}

function getSessionRow(sessionId: string): { user_id: string; expires_at: string } | undefined {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as
    | { user_id: string; expires_at: string }
    | undefined;
}

/**
 * Rezolvă utilizatorul curent — token Bearer întâi (clientul mobil), apoi
 * cookie (clientul web). Rutele API care trebuie apelabile și din aplicația
 * mobilă îi pasează `req`; restul pot apela fără argument (comportament
 * neschimbat, doar cookie).
 */
export async function getCurrentUser(req?: NextRequest): Promise<UserRow | null> {
  const bearerSessionId = getBearerSessionId(req);
  if (bearerSessionId) {
    const session = getSessionRow(bearerSessionId);
    if (session && new Date(session.expires_at) >= new Date()) {
      return getUserById(session.user_id) ?? null;
    }
    if (session) db.prepare("DELETE FROM sessions WHERE id = ?").run(bearerSessionId);
    return null;
  }

  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = getSessionRow(sessionId);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  return getUserById(session.user_id) ?? null;
}
