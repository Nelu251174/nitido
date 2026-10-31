import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ allowed: true, audit: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ isAdmin: async () => auth.allowed, auditAdminAction: auth.audit }));
vi.mock("@/lib/db", async () => {
  const { default: Sqlite } = await import("better-sqlite3");
  const db = new Sqlite(":memory:");
  db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT);
    CREATE TABLE firms(id TEXT PRIMARY KEY,user_id TEXT,cui TEXT,rating_sum INTEGER,rating_count INTEGER,strikes_30d INTEGER,strikes_90d INTEGER,suspended_until TEXT);
    CREATE TABLE jobs(id TEXT PRIMARY KEY);
    CREATE TABLE payments(id TEXT PRIMARY KEY);
    CREATE TABLE job_photos(id TEXT PRIMARY KEY);
    CREATE TABLE notification_outbox(id TEXT PRIMARY KEY);
    CREATE TABLE workflow_audit_log(id TEXT PRIMARY KEY);
    CREATE TABLE review_reports(id TEXT PRIMARY KEY);
    CREATE TABLE ratings(id TEXT PRIMARY KEY);
    CREATE TABLE strikes(id TEXT PRIMARY KEY);
  `);
  return { db };
});

import { db } from "@/lib/db";
import { POST } from "./route";

const origin = "http://localhost:3210";
const request = (body: unknown = { confirm: true }, site = origin, header: string | null = site) => new NextRequest(site + "/api/admin/reset-history", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(header === null ? {} : { Origin: header }) },
  body: JSON.stringify(body),
});
const history = ["jobs", "payments", "job_photos", "notification_outbox", "workflow_audit_log", "review_reports", "ratings", "strikes"];
const counts = () => history.map(table => db.prepare(`SELECT COUNT(*) count FROM ${table}`).get());

beforeEach(() => {
  auth.allowed = true;
  auth.audit.mockReset();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NITIDO_HISTORY_RESET_TEST_MODE", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  for (const table of history) {
    db.prepare(`DELETE FROM ${table}`).run();
    db.prepare(`INSERT INTO ${table}(id) VALUES(?)`).run("synthetic-history");
  }
  db.exec("DELETE FROM firms; DELETE FROM users; DELETE FROM sessions;");
  db.prepare("INSERT INTO users VALUES(?)").run("synthetic-user");
  db.prepare("INSERT INTO firms VALUES(?,?,?,?,?,?,?,?)").run("synthetic-firm", "synthetic-user", "RO99999999", 10, 2, 1, 1, "2099-01-01");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => db.close());

it.each([
  ["production", "true", "https://nitido.ro"],
  ["production", "true", "https://sandbox.nitido.ro"],
  ["production", "true", origin],
  ["development", "true", origin],
  ["test", "false", origin],
  ["test", "", origin],
  ["test", "true", "https://nitido.ro"],
  ["test", "true", "https://sandbox.nitido.ro"],
  ["test", "true", "http://127.0.0.1.evil.test:3210"],
  ["test", "true", "http://user:password@127.0.0.1:3210"],
  ["test", "true", "not-a-url"],
])("refuses reset without changing history for runtime %s, flag %s and site %s", async (runtime, flag, site) => {
  vi.stubEnv("NODE_ENV", runtime);
  vi.stubEnv("NITIDO_HISTORY_RESET_TEST_MODE", flag);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
  const before = counts();
  const response = await POST(request());
  expect(response.status).toBe(403);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(counts()).toEqual(before);
  expect(db.prepare("SELECT rating_sum,strikes_30d,suspended_until FROM firms").get()).toEqual({ rating_sum: 10, strikes_30d: 1, suspended_until: "2099-01-01" });
  expect(auth.audit).not.toHaveBeenCalled();
});

it.each([null, "https://foreign.test"])("rejects a missing or foreign Origin: %s", async header => {
  expect((await POST(request({ confirm: true }, origin, header))).status).toBe(403);
  expect(counts()).toEqual(history.map(() => ({ count: 1 })));
});

it("cannot use a local configuration to reset through a hosted request", async () => {
  expect((await POST(request({ confirm: true }, "https://nitido.ro"))).status).toBe(403);
  expect(counts()).toEqual(history.map(() => ({ count: 1 })));
});

it("still requires the existing Super Admin session in an isolated fixture", async () => {
  auth.allowed = false;
  expect((await POST(request())).status).toBe(401);
  expect(counts()).toEqual(history.map(() => ({ count: 1 })));
});

it.each([{}, { confirm: false }, { confirm: "true" }])("still requires explicit confirmation: %j", async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(counts()).toEqual(history.map(() => ({ count: 1 })));
});

it("allows an explicitly enabled local test fixture to reset its synthetic history", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, jobs: 1, payments: 1, photos: 1, notifications: 1 });
  expect(counts()).toEqual(history.map(() => ({ count: 0 })));
  expect(db.prepare("SELECT id FROM users").all()).toEqual([{ id: "synthetic-user" }]);
  expect(auth.audit).toHaveBeenCalledWith("history.reset", null, expect.objectContaining({ jobs: 1 }));
});
