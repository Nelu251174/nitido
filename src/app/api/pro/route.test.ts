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
  emailConfigured: vi.fn(() => false),
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/emailVerification", () => ({ emailIsVerified: () => true }));
import { GET, POST } from "./[...path]/route";
import { emailConfigured, sendEmail } from "@/lib/email";
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
  vi.mocked(emailConfigured).mockReset().mockReturnValue(false);
  vi.mocked(sendEmail).mockReset().mockResolvedValue(true);
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
it('exports all 1000 permitted rows and rejects a larger report instead of silently truncating',async()=>{
 const insert=state.db.prepare("INSERT INTO pro_cost_entries(id,organization_id,property_id,category,amount,created_at) VALUES(?,?,?,'service',12345,'2027-01-01T12:00:00Z')");state.db.transaction(()=>{for(let i=0;i<1000;i++)insert.run('cost-'+String(i).padStart(4,'0'),org,prop);})();
 const response=await read('reports/export?organization_id='+org);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect((await response.text()).split('\r\n')).toHaveLength(1001);
 insert.run('overflow',org,prop);const rejected=await read('reports/export?organization_id='+org);expect(rejected.status).toBe(422);expect((await rejected.json()).error).toContain('Restrânge');expect(state.db.prepare("SELECT COUNT(*) n FROM pro_audit_logs WHERE action='report.export'").get()).toEqual({n:1});
});
it('filters property permissions before counting the report limit',async()=>{
 const otherProp=core.createProperty(state.db,{id:'owner'},{organization_id:org,name:'Hidden',city:'Constanța',address:'Hidden'}).id;
 state.db.prepare("INSERT INTO pro_members VALUES('scoped',?,'foreign','manager',?,1)").run(org,JSON.stringify([prop]));
 const insert=state.db.prepare("INSERT INTO pro_cost_entries(id,organization_id,property_id,category,amount,created_at) VALUES(?,?,?,?,?,?)");state.db.transaction(()=>{for(let i=0;i<1001;i++)insert.run('hidden-'+i,org,otherProp,'SECRET',100,'2027-02-01T00:00:00Z');insert.run('allowed',org,prop,'VISIBLE',250,'2027-01-01T00:00:00Z');})();
 state.user={id:'foreign'};const response=await read('reports/export?organization_id='+org);expect(response.status).toBe(200);const csv=await response.text();expect(csv).toContain('VISIBLE');expect(csv).not.toContain('SECRET');expect(csv.split('\r\n')).toHaveLength(2);
});

it("limits cost changes to the operator property scope including organization-wide costs", async () => {
  const second = core.createProperty(state.db, { id: "owner" }, { organization_id: org, name: "A2", city: "Constanța", address: "Other" }).id;
  state.db.prepare("INSERT INTO pro_members VALUES('operator-scoped',?,'foreign','operator',?,1)").run(org, JSON.stringify([prop]));
  state.db.prepare("INSERT INTO pro_members VALUES('viewer-global',?,'foreign','viewer','[]',1)").run(org);
  const add = state.db.prepare("INSERT INTO pro_cost_entries(id,organization_id,property_id,category,amount,created_at) VALUES(?,?,?,'cleaning',500,?)");
  for (const [id, property] of [["scoped", prop], ["other", second], ["general", null]]) add.run(id, org, property, new Date().toISOString());
  state.user = { id: "foreign" };
  const body = { status: "invoiced_external", invoice_ref: "TEST-DOC" };
  expect((await post("costs/scoped", body)).status).toBe(200);
  expect((await post("costs/other", body)).status).toBe(404);
  expect((await post("costs/general", body)).status).toBe(404);
  expect(state.db.prepare("SELECT status,invoice_ref FROM pro_cost_entries WHERE id='general'").get()).toEqual({ status: "validated", invoice_ref: "" });
  expect(state.db.prepare("SELECT COUNT(*) n FROM pro_audit_logs WHERE action='cost.external_record'").get()).toEqual({ n: 1 });
  state.user = { id: "owner" };
  expect((await post("costs/general", body)).status).toBe(200);
  state.user = { id: "foreign" };
  state.db.prepare("UPDATE pro_members SET scope_json='[]' WHERE id='operator-scoped'").run();
  expect((await post("costs/other", body)).status).toBe(200);
});

it("carries a Pro booking through approval, partner execution, review and a single exported cost", async () => {
  state.db.exec("INSERT INTO users VALUES('provider','Provider','provider@example.test','firma')");
  state.db.prepare("INSERT INTO pro_members VALUES('approver-flow',?,'foreign','approver','[]',1)").run(org);
  state.db.prepare("INSERT INTO pro_partners VALUES('flow-firm','Firmă test','TEST','active',?,?,'TEST-VERIFIED')").run(JSON.stringify(["Constanța"]), JSON.stringify(["cleaning_recurring"]));
  state.db.exec("INSERT INTO pro_partner_members VALUES('flow-firm','provider',1)");
  const created = await post("work-orders", { property_id: prop, title: "TEST flux complet", service: "cleaning_recurring", starts_at: new Date(Date.now() + 3600000).toISOString(), ends_at: new Date(Date.now() + 7200000).toISOString(), estimate: 1000 });
  expect(created.status).toBe(200);
  const { id } = await created.json();
  const current = () => state.db.prepare("SELECT * FROM pro_work_orders WHERE id=?").get(id) as core.Work;
  const command = (action: string, body: object = {}, key = crypto.randomUUID()) => post(`work-orders/${id}/${action}`, { ...body, revision: current().revision }, key);
  state.user = null;
  state.admin = true;
  expect((await command("offer", { partner_id: "flow-firm" })).status).toBe(409);
  state.admin = false;
  state.user = { id: "foreign" };
  const approvals = await (await read("approvals?organization_id=" + org)).json();
  expect((await post("approvals/" + approvals[0].id, { decision: "approved", amount: 1000, note: "Deviz confirmat" })).status).toBe(200);
  state.user = null;
  state.admin = true;
  expect((await command("offer", { partner_id: "flow-firm" })).status).toBe(200);
  state.admin = false;
  state.user = { id: "provider" };
  const preview = await (await read("work-orders/" + id)).json();
  expect(preview.property).not.toHaveProperty("address");
  expect((await command("accept")).status).toBe(200);
  expect((await (await read("work-orders/" + id)).json()).property.address).toBe("PRIVATE_ADDRESS");
  expect((await command("start")).status).toBe(200);
  expect((await command("submit", { final_cost: 900 })).status).toBe(409);
  const answers = Object.fromEntries(JSON.parse(current().checklist_json).map((_: string, i: number) => [String(i), true]));
  expect((await command("checklist", { answers })).status).toBe(200);
  expect((await command("submit", { final_cost: 900 })).status).toBe(409);
  // Media fixture represents an uploaded proof; image processing is tested separately.
  state.db.prepare("INSERT INTO pro_media VALUES('flow-proof',?,?,NULL,'after','flow.webp','image/webp',12,'flow-hash','provider',?)").run(org, id, new Date().toISOString());
  expect((await command("submit", { final_cost: 1001 })).status).toBe(409);
  expect((await command("submit", { final_cost: 900 })).status).toBe(200);
  expect((await command("complete")).status).toBe(404);
  state.user = null;
  state.admin = true;
  const key = crypto.randomUUID();
  const body = { revision: current().revision, note: "Verificat" };
  expect((await post(`work-orders/${id}/complete`, body, key)).status).toBe(200);
  expect((await post(`work-orders/${id}/complete`, body, key)).status).toBe(200);
  expect(state.db.prepare("SELECT amount FROM pro_cost_entries WHERE work_order_id=?").all(id)).toEqual([{ amount: 900 }]);
  state.admin = false;
  state.user = { id: "provider" };
  expect((await read("work-orders/" + id)).status).toBe(404);
  state.user = { id: "owner" };
  const rows = await (await read("costs?organization_id=" + org)).json();
  expect(rows).toMatchObject([{ work_order_id: id, amount: 900 }]);
  const exported = await read("reports/export?organization_id=" + org);
  expect(exported.status).toBe(200);
  expect((await exported.text()).trim().split("\r\n")).toHaveLength(2);
  expect(current().status).toBe("completed");
});

function notificationWork(propertyId = prop) {
  return core.createWork(state.db, { id: "owner" }, {
    property_id: propertyId, title: "TEST notificări", service: "cleaning_recurring",
    starts_at: new Date(Date.now() + 3600000).toISOString(),
    ends_at: new Date(Date.now() + 7200000).toISOString(), estimate: 1000,
  }).id;
}
function queueNotice(id: string, user: string, href: string, event = id, organizationId = org, stamp = "2026-01-01T00:00:00Z") {
  state.db.prepare("INSERT INTO pro_notifications(id,organization_id,user_id,event_key,title,href,next_attempt,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(id, organizationId, user, event, "Actualizare test", href, stamp, stamp);
}
async function dispatchTestNotifications() {
  vi.mocked(emailConfigured).mockReturnValue(true);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://nitido.example.test");
  vi.stubEnv("CRON_SECRET", "test-notifications-secret");
  return POST(new NextRequest("http://localhost/api/pro/cron", { method: "POST", headers: { "x-cron-secret": "test-notifications-secret" } }), { params: Promise.resolve({ path: ["cron"] }) });
}
it("revokes notification reads and queued emails even when the former member belongs to another active partner", async () => {
  state.db.prepare("INSERT INTO pro_members VALUES('revoked-reader',?,'foreign','manager','[]',1)").run(org);
  const id = notificationWork();
  state.db.exec("DELETE FROM pro_notifications");
  queueNotice("revoked-notice", "foreign", "/pro/lucrari/" + id);
  state.user = { id: "foreign" };
  expect(await (await read("notifications")).json()).toHaveLength(1);
  state.db.exec("UPDATE pro_members SET active=0 WHERE id='revoked-reader'; INSERT INTO pro_partners VALUES('unrelated','Other','TEST','active','[]','[]','TEST'); INSERT INTO pro_partner_members VALUES('unrelated','foreign',1)");
  expect(await (await read("notifications")).json()).toEqual([]);
  expect((await post("notifications/revoked-notice", {})).status).toBe(404);
  expect((await dispatchTestNotifications()).status).toBe(200);
  expect(sendEmail).not.toHaveBeenCalled();
  expect(state.db.prepare("SELECT email_status,read_at FROM pro_notifications WHERE id='revoked-notice'").get()).toEqual({ email_status: "disabled", read_at: null });
});
it("filters notification scope before the display limit and after membership changes", async () => {
  const second = core.createProperty(state.db, { id: "owner" }, { organization_id: org, name: "Second", city: "Constanța", address: "Private" }).id;
  state.db.prepare("INSERT INTO pro_members VALUES('changed-scope',?,'foreign','manager','[]',1)").run(org);
  const visible = notificationWork();
  const hidden = notificationWork(second);
  state.db.exec("DELETE FROM pro_notifications");
  queueNotice("visible-notice", "foreign", "/pro/lucrari/" + visible);
  for (let i = 0; i < 105; i++) queueNotice("hidden-" + i, "foreign", "/pro/lucrari/" + hidden, "hidden-" + i, org, "2026-02-01T00:00:00Z");
  state.db.prepare("UPDATE pro_members SET scope_json=? WHERE id='changed-scope'").run(JSON.stringify([prop]));
  state.user = { id: "foreign" };
  const rows = await (await read("notifications")).json();
  expect(rows).toMatchObject([{ id: "visible-notice" }]);
  expect(rows[0]).not.toHaveProperty("user_id");
  expect((await post("notifications/hidden-0", {})).status).toBe(404);
  expect((await post("notifications/visible-notice", {})).status).toBe(200);
});
it("dispatches only currently authorized notification targets, with mock email delivery", async () => {
  const second = core.createProperty(state.db, { id: "owner" }, { organization_id: org, name: "Second", city: "Constanța", address: "Private" }).id;
  state.db.prepare("INSERT INTO pro_members VALUES('mail-scope',?,'foreign','manager',?,1)").run(org, JSON.stringify([prop]));
  const visible = notificationWork();
  const hidden = notificationWork(second);
  state.db.exec("DELETE FROM pro_notifications");
  queueNotice("visible", "foreign", "/pro/lucrari/" + visible);
  queueNotice("scope-denied", "foreign", "/pro/lucrari/" + hidden);
  queueNotice("external-target", "foreign", "https://untrusted.example.test/collect");
  queueNotice("wrong-org", "foreign", "/pro/lucrari/" + visible, "wrong-org", "different-org");
  const response = await dispatchTestNotifications();
  expect(response.status).toBe(200);
  expect((await response.json()).email.sent).toBe(1);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: "other@example.test" });
  expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("https://nitido.example.test/pro/lucrari/" + visible);
  expect(state.db.prepare("SELECT id FROM pro_notifications WHERE email_status='disabled' ORDER BY id").all()).toEqual([{ id: "external-target" }, { id: "scope-denied" }, { id: "wrong-org" }]);
});
it("rechecks ticket and recurring-calendar property access for stored notifications", async () => {
  state.db.prepare("INSERT INTO pro_members VALUES('target-scope',?,'foreign','manager','[]',1)").run(org);
  const ticket = core.createTicket(state.db, { id: "owner" }, { property_id: prop, title: "Test", description: "Test incident", priority: "normal" }).id;
  const rule = core.createRecurring(state.db, { id: "owner" }, { property_id: prop, title: "Test", service: "cleaning_recurring", frequency: "weekly", start_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), hour: 12, duration: 60, estimate: 0 }).id;
  state.db.exec("DELETE FROM pro_notifications");
  queueNotice("ticket-notice", "foreign", "/pro/tichete/" + ticket);
  queueNotice("calendar-notice", "foreign", "/pro/calendar", rule + ":2026-01-01:missed");
  state.user = { id: "foreign" };
  expect(await (await read("notifications")).json()).toHaveLength(2);
  state.db.prepare("UPDATE pro_members SET scope_json=? WHERE id='target-scope'").run(JSON.stringify(["no-access"]));
  expect(await (await read("notifications")).json()).toEqual([]);
});
it("finds a partner's work beyond 500 other bookings and removes access after offer expiry", async () => {
  state.db.exec("INSERT INTO pro_partners VALUES('target-firm','Target','TEST','active','[]','[]','TEST'); INSERT INTO pro_partner_members VALUES('target-firm','foreign',1)");
  const id = notificationWork();
  state.db.prepare("UPDATE pro_work_orders SET status='offered' WHERE id=?").run(id);
  state.db.prepare("INSERT INTO pro_offers VALUES('target-offer',?,?,'target-firm','offered',?,?)").run(org, id, new Date(Date.now()+3600000).toISOString(), new Date().toISOString());
  const insert = state.db.prepare("INSERT INTO pro_work_orders(id,organization_id,property_id,title,service,status,starts_at,ends_at,threshold_snapshot,estimate,financial_status,checklist_json,created_by,created_at) VALUES(?,?,?,'Other','cleaning_recurring','scheduled','2026-01-01T10:00:00Z','2026-01-01T11:00:00Z',0,0,'not_required','[]','owner','2026-01-01T00:00:00Z')");
  state.db.transaction(() => { for (let i = 0; i < 505; i++) insert.run("other-"+i, org, prop); })();
  state.db.exec("DELETE FROM pro_notifications");
  queueNotice("partner-notice", "foreign", "/pro/lucrari/" + id);
  state.user = { id: "foreign" };
  const rows = await (await read("partner")).json();
  expect(rows).toMatchObject([{ id }]);
  expect(rows[0].property).not.toHaveProperty("address");
  expect(await (await read("notifications")).json()).toHaveLength(1);
  state.db.exec("UPDATE pro_offers SET expires_at='2000-01-01' WHERE id='target-offer'");
  expect(await (await read("partner")).json()).toEqual([]);
  expect(await (await read("notifications")).json()).toEqual([]);
  state.db.prepare("UPDATE pro_work_orders SET status='accepted',partner_id='target-firm' WHERE id=?").run(id);
  expect(await (await read("partner")).json()).toMatchObject([{ id, property: { address: "PRIVATE_ADDRESS" } }]);
  expect(await (await read("notifications")).json()).toHaveLength(1);
  state.db.exec("UPDATE pro_partners SET status='suspended' WHERE id='target-firm'");
  expect(await (await read("partner")).json()).toEqual([]);
  expect(await (await read("notifications")).json()).toEqual([]);
});
