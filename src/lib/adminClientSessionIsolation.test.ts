import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cookies = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => cookies.has(name) ? { name, value: cookies.get(name)! } : undefined,
  set: (name: string, value: string) => cookies.set(name, value),
  delete: (name: string) => cookies.delete(name),
}) }));
vi.mock("@/lib/db", async () => {
  const { default: Sqlite } = await import("better-sqlite3");
  const { randomUUID } = await import("node:crypto");
  const { ADMIN_MFA_SCHEMA } = await import("./adminMfa");
  const { ADMIN_STAFF_SCHEMA } = await import("./adminStaff");
  const { ADMIN_PASSWORD_RECOVERY_SCHEMA } = await import("./adminPasswordCredentials");
  const db = new Sqlite(":memory:");
  db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT,name TEXT,email TEXT);
    CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
    CREATE TABLE admin_sessions(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE,expires_at TEXT);
    CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT);
    ${ADMIN_MFA_SCHEMA}
    ${ADMIN_STAFF_SCHEMA}
    ${ADMIN_PASSWORD_RECOVERY_SCHEMA}
  `);
  return { db, getUserById: (id: string) => db.prepare("SELECT * FROM users WHERE id=?").get(id), newId: () => randomUUID() };
});

import { db } from "./db";
import { getCurrentUser, destroySession } from "./auth";
import { authenticateAdmin, destroyAdminSession, getAdminIdentity, isAdmin } from "./adminAuth";
import { getAdminSecurityConfig, totpAt } from "./adminMfa";
import { GET as adminSession } from "@/app/api/admin/auth/me/route";

beforeEach(() => {
  cookies.clear();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NITIDO_ENABLE_BEARER_AUTH", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3210");
  vi.stubEnv("NITIDO_ADMIN_EMAIL", "same-email@example.test");
  vi.stubEnv("NITIDO_ADMIN_PASSWORD", "synthetic-admin-password");
  vi.stubEnv("NITIDO_ADMIN_PASSWORD_HASH", "");
  vi.stubEnv("NITIDO_ADMIN_TOTP_SECRET", "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  vi.stubEnv("NITIDO_ADMIN_RECOVERY_HASHES", "");
  vi.stubEnv("NITIDO_ADMIN_STAFF_ACCOUNTS_JSON", "[]");
  for (const table of ["sessions", "users", "admin_sessions", "admin_session_mfa", "admin_session_identity", "admin_totp_state", "admin_staff", "admin_audit_log"]) db.prepare(`DELETE FROM ${table}`).run();
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run("synthetic-client", "client", "Synthetic client", "same-email@example.test");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run("synthetic-client-token", "synthetic-client", new Date(Date.now() + 60000).toISOString());
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => db.close());

async function adminLogin() {
  const config = getAdminSecurityConfig()!;
  expect(await authenticateAdmin(config.email, "synthetic-admin-password", totpAt(config.secret, Math.floor(Date.now() / 30000)), "totp")).toBe(true);
}

it("rejects a valid client cookie at ADMIN even when the account email matches the administrator", async () => {
  cookies.set("nitido_session", "synthetic-client-token");
  expect(await getCurrentUser()).toMatchObject({ id: "synthetic-client", role: "client" });
  expect(await getAdminIdentity()).toBeNull();
  expect(await isAdmin()).toBe(false);
  const response = await adminSession();
  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ error: "Neautorizat" });
});

it("does not accept a client token copied into the administrative cookie", async () => {
  cookies.set("nitido_admin_session", "synthetic-client-token");
  expect(await getAdminIdentity()).toBeNull();
  expect((await adminSession()).status).toBe(401);
});

it("does not promote the authenticated mobile Bearer session to ADMIN", async () => {
  const request = new NextRequest("http://localhost:3210/api/admin/auth/me", { headers: { Authorization: "Bearer synthetic-client-token" } });
  expect(await getCurrentUser(request)).toMatchObject({ id: "synthetic-client", role: "client" });
  expect(await getAdminIdentity()).toBeNull();
  expect((await adminSession()).status).toBe(401);
});

it("requires its own client session even after a genuine administrative MFA login", async () => {
  await adminLogin();
  expect(await getAdminIdentity()).toMatchObject({ role: "super_admin" });
  expect(await getCurrentUser()).toBeNull();
  expect((await adminSession()).status).toBe(200);
});

it("closes the ADMIN session without deleting the independent client session", async () => {
  cookies.set("nitido_session", "synthetic-client-token");
  await adminLogin();
  await destroyAdminSession();
  expect((await adminSession()).status).toBe(401);
  expect(await getCurrentUser()).toMatchObject({ id: "synthetic-client" });
});

it("does not disguise a retained administrative session as a client login", async () => {
  cookies.set("nitido_session", "synthetic-client-token");
  await adminLogin();
  await destroySession();
  expect(await getCurrentUser()).toBeNull();
  expect(await getAdminIdentity()).toMatchObject({ email: "same-email@example.test", role: "super_admin" });
});
