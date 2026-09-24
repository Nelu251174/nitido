import { beforeEach, afterEach, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { migratePro } from "@/lib/pro/schema";
import * as core from "@/lib/pro/core";
const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  user: null as { id: string } | null,
  admin: false,
}));
vi.mock("@/lib/db", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/adminAuth", () => ({ isAdmin: async () => state.admin }));
vi.mock("@/lib/email", () => ({
  emailConfigured: () => false,
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/emailVerification", () => ({ emailIsVerified: () => true }));
import { GET, POST } from "./[...path]/route";
let org: string, prop: string;
const read = (path: string) =>
  GET(new NextRequest("http://localhost/api/pro/" + path), {
    params: Promise.resolve({ path: path.split("?")[0].split("/") }),
  });
const post = (path: string, b: object, key = crypto.randomUUID()) =>
  POST(
    new NextRequest("http://localhost/api/pro/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": key,
        origin: "http://localhost",
      },
      body: JSON.stringify(b),
    }),
    { params: Promise.resolve({ path: path.split("/") }) },
  );
beforeEach(() => {
  state.db = new Database(":memory:");
  state.db.pragma("foreign_keys=ON");
  state.db.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT); INSERT INTO users VALUES('owner','Owner','owner@example.test','client'),('foreign','Other','other@example.test','client')",
  );
  migratePro(state.db);
  org = core.createOrg(
    state.db,
    { id: "admin", admin: true },
    { name: "A", city: "Constanța", owner_id: "owner", contract_ref: "test" },
  ).id;
  prop = core.createProperty(
    state.db,
    { id: "owner" },
    {
      organization_id: org,
      name: "A1",
      city: "Constanța",
      address: "PRIVATE_ADDRESS",
    },
  ).id;
  state.db.prepare("UPDATE pro_organizations SET status='active'").run();
  state.user = { id: "owner" };
  state.admin = false;
  vi.stubEnv("NITIDO_PRO_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_NITIDO_PRO_PUBLIC", "true");
});
afterEach(() => {
  state.db.close();
  vi.unstubAllEnvs();
});
it("returns 401 to anonymous and 404 when disabled", async () => {
  state.user = null;
  expect((await read("context")).status).toBe(401);
  vi.stubEnv("NITIDO_PRO_ENABLED", "false");
  expect((await read("context")).status).toBe(404);
});
it("prevents cross tenant property, lists, export and manual commands", async () => {
  state.user = { id: "foreign" };
  expect((await read("properties/" + prop)).status).toBe(404);
  expect((await read("properties?organization_id=" + org)).status).toBe(404);
  expect((await read("reports/export?organization_id=" + org)).status).toBe(
    404,
  );
  expect(
    (
      await post("properties", {
        organization_id: org,
        name: "X",
        city: "X",
        address: "X",
      })
    ).status,
  ).toBe(404);
});
it("masks property address in listings but authorizes the detail", async () => {
  const rows = await (await read("properties?organization_id=" + org)).json();
  expect(JSON.stringify(rows)).not.toContain("PRIVATE_ADDRESS");
  expect((await (await read("properties/" + prop)).json()).address).toBe(
    "PRIVATE_ADDRESS",
  );
});
it("validates CSRF and rejects financial admin override routes", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/pro/organizations", {
      method: "POST",
      headers: { origin: "https://evil.example" },
      body: "{}",
    }),
    { params: Promise.resolve({ path: ["organizations"] }) },
  );
  expect(response.status).toBe(403);
  expect(
    (await post("quotes/id/override", { reason: "try override" })).status,
  ).toBe(404);
});
it("creates work through the API and replays only once", async () => {
  const b = {
      property_id: prop,
      title: "Test",
      service: "cleaning_recurring",
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
      estimate: 100,
    },
    key = crypto.randomUUID();
  const first = await post("work-orders", b, key);
  expect(first.status).toBe(200);
  const id = (await first.json()).id;
  expect((await (await post("work-orders", b, key)).json()).id).toBe(id);
  expect(
    state.db.prepare("SELECT count(*) n FROM pro_work_orders").get(),
  ).toEqual({ n: 1 });
  expect(
    (await post("work-orders/" + id + "/complete", { revision: 1 })).status,
  ).toBe(404);
});
it("does not let an owner grant NITIDO operator privileges", async () => {
  expect(
    (
      await post("invites", {
        organization_id: org,
        email: "other@example.test",
        role: "operator",
        scope: [],
      })
    ).status,
  ).toBe(422);
});
it("stores and validates client qualification leads", async () => {
  state.user = null;
  const b = {
    name: "Client",
    email: "client@example.test",
    phone: "0700000000",
    city: "Constanța",
    property_count: 5,
    consent: true,
  };
  expect((await post("leads", b)).status).toBe(201);
  expect((await post("leads", { ...b, property_count: 1 })).status).toBe(422);
  expect(state.db.prepare("SELECT count(*) n FROM pro_leads").get()).toEqual({
    n: 1,
  });
});
it("creates and accepts a scoped invitation once", async () => {
  const r = await post("invites", {
    organization_id: org,
    email: "other@example.test",
    role: "viewer",
    scope: [prop],
  });
  expect(r.status).toBe(200);
  const result = await r.json();
  const token = result.invite_path.split("=")[1];
  state.user = { id: "foreign" };
  const accept = await post("invites/accept", { token });
  expect(accept.status).toBe(200);
  expect((await post("invites/accept", { token })).status).toBe(404);
  expect((await read("properties?organization_id=" + org)).status).toBe(200);
  expect((await read("reports/export?organization_id=" + org)).status).toBe(
    404,
  );
});

it("revokes invitations and stores no reusable plaintext token", async () => {
  const result = await (
    await post("invites", {
      organization_id: org,
      email: "other@example.test",
      role: "viewer",
      scope: [prop],
    })
  ).json();
  const token = result.invite_path.split("=")[1];
  expect(
    JSON.stringify(state.db.prepare("SELECT * FROM pro_idempotency").all()),
  ).not.toContain(token);
  const list = await (await read("invites?organization_id=" + org)).json();
  expect(JSON.stringify(list)).not.toContain(token);
  expect((await post("invites/" + list[0].id + "/revoke", {})).status).toBe(
    200,
  );
  state.user = { id: "foreign" };
  expect((await post("invites/accept", { token })).status).toBe(404);
});
it("blocks archive during active work and clears access secrets on archive", async () => {
  vi.stubEnv("NITIDO_PRO_ACCESS_KEY", "a".repeat(64));
  core.saveCredential(state.db, { id: "owner" }, prop, {
    secret: "PRIVATE_CODE",
  });
  const w = core.createWork(
    state.db,
    { id: "owner" },
    {
      property_id: prop,
      title: "Test",
      service: "cleaning_recurring",
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
      estimate: 0,
    },
  );
  const body = { name: "A1", address: "PRIVATE_ADDRESS", status: "archived" };
  expect((await post("properties/" + prop + "/update", body)).status).toBe(409);
  expect(
    (
      await post("work-orders/" + w.id + "/cancel", {
        revision: 1,
        note: "Archive approved",
      })
    ).status,
  ).toBe(200);
  expect((await post("properties/" + prop + "/update", body)).status).toBe(200);
  expect(
    state.db.prepare("SELECT count(*) n FROM pro_access_credentials").get(),
  ).toEqual({ n: 0 });
});
it("reschedules once with optimistic concurrency and preserves approval snapshot", async () => {
  const w = core.createWork(
    state.db,
    { id: "owner" },
    {
      property_id: prop,
      title: "Test",
      service: "cleaning_recurring",
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
      estimate: 100,
    },
  );
  const b = {
    revision: 1,
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90000000).toISOString(),
  };
  expect((await post("work-orders/" + w.id + "/reschedule", b)).status).toBe(
    200,
  );
  expect((await post("work-orders/" + w.id + "/reschedule", b)).status).toBe(
    409,
  );
  expect(
    state.db
      .prepare(
        "SELECT threshold_snapshot,financial_status FROM pro_work_orders WHERE id=?",
      )
      .get(w.id),
  ).toEqual({ threshold_snapshot: 0, financial_status: "pending" });
});
