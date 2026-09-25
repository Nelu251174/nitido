import { beforeEach, afterEach, describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { migratePro } from "./schema";
import * as p from "./core";
import { csvCell } from "./shared";
let db: Database.Database,
  org: string,
  other: string,
  prop: string,
  otherProp: string;
const admin = { id: "admin", admin: true },
  owner = { id: "owner" },
  approver = { id: "approver" },
  partner = { id: "partner" },
  stranger = { id: "stranger" };
const run = (
  who: p.Principal,
  b: object,
  fn: () => object,
  key = crypto.randomUUID(),
) => p.atomic(db, who, key, b, fn);
function order(amount = 1000) {
  return run(owner, { amount }, () =>
    p.createWork(db, owner, {
      property_id: prop,
      title: "Curățenie test",
      service: "cleaning_recurring",
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
      estimate: amount,
    }),
  ) as { id: string };
}
function get(id: string) {
  return db
    .prepare("SELECT * FROM pro_work_orders WHERE id=?")
    .get(id) as p.Work;
}
function cmd(who: p.Principal, id: string, action: string, b: object = {}) {
  const body = { ...b, revision: get(id).revision };
  return run(who, body, () => p.workCommand(db, who, id, action, body));
}
function approve(id: string) {
  const a = db
    .prepare(
      "SELECT * FROM pro_approvals WHERE work_order_id=? ORDER BY quote_version DESC",
    )
    .get(id) as { id: string; amount: number };
  return run(approver, a, () =>
    p.decide(db, approver, a.id, {
      decision: "approved",
      amount: a.amount,
      note: "Confirm devizul",
    }),
  );
}
function accepted() {
  const { id } = order();
  approve(id);
  cmd(admin, id, "offer", { partner_id: "firm" });
  cmd(partner, id, "accept");
  return id;
}
beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT); INSERT INTO users VALUES('owner','Owner','owner@example.test','client'),('approver','Approver','approver@example.test','client'),('partner','Partner','partner@example.test','firma'),('stranger','Stranger','stranger@example.test','client')",
  );
  migratePro(db);
  org = p.createOrg(db, admin, {
    name: "Portofoliu A",
    city: "Constanța",
    owner_id: "owner",
    contract_ref: "TEST-A",
  }).id;
  other = p.createOrg(db, admin, {
    name: "Portofoliu B",
    city: "Constanța",
    owner_id: "stranger",
    contract_ref: "TEST-B",
  }).id;
  prop = p.createProperty(db, owner, {
    organization_id: org,
    name: "Apartament A",
    city: "Constanța",
    address: "Adresă privată A",
  }).id;
  otherProp = p.createProperty(db, stranger, {
    organization_id: other,
    name: "Apartament B",
    city: "Constanța",
    address: "Adresă privată B",
  }).id;
  db.prepare("UPDATE pro_organizations SET status='active'").run();
  db.prepare(
    "INSERT INTO pro_members VALUES('approve',?,?,'approver','[]',1)",
  ).run(org, approver.id);
  db.prepare(
    "INSERT INTO pro_partners VALUES('firm','Firmă test','TEST','active',?,?, 'test-verification')",
  ).run(JSON.stringify(["Constanța"]), JSON.stringify(["cleaning_recurring"]));
  db.prepare(
    "INSERT INTO pro_partner_members VALUES('firm','partner',1)",
  ).run();
});
afterEach(() => db.close());
describe("Pro v1.1 database integration", () => {
  it("preserves legacy tables and refuses destructive automatic migration", () => {
    const legacy = new Database(":memory:");
    legacy.exec(
      "CREATE TABLE pro_organizations(id TEXT); INSERT INTO pro_organizations VALUES('existing')",
    );
    expect(() => migratePro(legacy)).toThrow("Legacy");
    expect(legacy.prepare("SELECT id FROM pro_organizations").get()).toEqual({
      id: "existing",
    });
    legacy.close();
  });
  it("rejects access across organizations and compound property mismatches", () => {
    expect(() => p.property(db, owner, otherProp)).toThrow();
    expect(() => p.collection(db, owner, other, "properties")).toThrow();
    expect(() =>
      db
        .prepare("UPDATE pro_properties SET organization_id=? WHERE id=?")
        .run("invalid", prop),
    ).toThrow();
  });
  it("keeps the threshold snapshot and blocks execution until approval", () => {
    const { id } = order();
    expect(get(id).financial_status).toBe("pending");
    db.prepare("UPDATE pro_organizations SET threshold=999999 WHERE id=?").run(
      org,
    );
    expect(get(id).threshold_snapshot).toBe(0);
    expect(() => cmd(admin, id, "offer", { partner_id: "firm" })).toThrow(
      "autorizarea",
    );
    approve(id);
    expect(() => cmd(admin, id, "offer", { partner_id: "firm" })).not.toThrow();
  });
  it("cannot self approve or use administrator privileges for client money", () => {
    const { id } = order();
    const a = db
      .prepare("SELECT * FROM pro_approvals WHERE work_order_id=?")
      .get(id) as { id: string };
    expect(() =>
      run(owner, {}, () =>
        p.decide(db, owner, a.id, {
          decision: "approved",
          amount: 1000,
          note: "Approve",
        }),
      ),
    ).toThrow();
    expect(() =>
      run(admin, {}, () =>
        p.decide(db, admin, a.id, {
          decision: "approved",
          amount: 1000,
          note: "Approve",
        }),
      ),
    ).toThrow();
  });
  it("requires a new approval for a changed quote and refuses stale decisions", () => {
    const { id } = order();
    approve(id);
    cmd(owner, id, "quote", { amount: 1500, note: "Consumabile suplimentare" });
    expect(get(id).financial_status).toBe("pending");
    expect(get(id).quote_version).toBe(2);
    expect(() => cmd(admin, id, "offer", { partner_id: "firm" })).toThrow();
    approve(id);
    expect(get(id).financial_status).toBe("approved");
  });
  it("accepts a single offer, hides address before accept and revokes after cancel", () => {
    const { id } = order();
    approve(id);
    cmd(admin, id, "offer", { partner_id: "firm" });
    expect(
      p.workView(db, partner, p.work(db, partner, id)).property,
    ).not.toHaveProperty("address");
    cmd(partner, id, "accept");
    expect(
      p.workView(db, partner, p.work(db, partner, id)).property.address,
    ).toBe("Adresă privată A");
    expect(() => cmd(partner, id, "accept")).toThrow();
    cmd(owner, id, "cancel", { note: "Anulare documentată" });
    expect(() => p.work(db, partner, id)).toThrow();
  });
  it("refusal and expiry return work to scheduling", () => {
    const { id } = order();
    approve(id);
    cmd(admin, id, "offer", { partner_id: "firm" });
    cmd(partner, id, "decline");
    expect(get(id).status).toBe("scheduled");
    cmd(admin, id, "offer", { partner_id: "firm" });
    db.prepare(
      "UPDATE pro_offers SET expires_at='2000-01-01' WHERE status='offered'",
    ).run();
    expect(p.runRecurring(db).expired).toBe(1);
    expect(get(id).status).toBe("scheduled");
  });
  it("requires complete checklist, photo, authorized final cost and QC", () => {
    const id = accepted();
    cmd(partner, id, "start");
    expect(() => cmd(partner, id, "submit", { final_cost: 1000 })).toThrow(
      "punctele",
    );
    const answers = Object.fromEntries(
      (JSON.parse(get(id).checklist_json) as string[]).map((_, i) => [
        String(i),
        true,
      ]),
    );
    cmd(partner, id, "checklist", { answers });
    expect(() => cmd(partner, id, "submit", { final_cost: 1000 })).toThrow(
      "dovada",
    );
    db.prepare(
      "INSERT INTO pro_media VALUES('m',?,?,NULL,'after','m.webp','image/webp',12,'hash','partner',?)",
    ).run(org, id, new Date().toISOString());
    expect(() => cmd(partner, id, "submit", { final_cost: 1001 })).toThrow(
      "suplimentar",
    );
    cmd(partner, id, "submit", { final_cost: 1000 });
    expect(() => cmd(partner, id, "complete")).toThrow();
    cmd(admin, id, "complete", { note: "QC verificat" });
    expect(get(id).status).toBe("completed");
    expect(db.prepare("SELECT COUNT(*) n FROM pro_cost_entries").get()).toEqual(
      { n: 1 },
    );
    expect(() => p.work(db, partner, id)).toThrow();
    expect(() => cmd(admin, id, "complete")).toThrow();
  });
  it("rejects stale revisions and replays a confirmed command once", () => {
    const { id } = order();
    const b = { revision: 1, note: "Anulare test" },
      key = crypto.randomUUID();
    const result = run(
      owner,
      b,
      () => p.workCommand(db, owner, id, "cancel", b),
      key,
    );
    expect(
      run(owner, b, () => p.workCommand(db, owner, id, "cancel", b), key),
    ).toEqual(result);
    expect(() => run(owner, { note: "changed" }, () => ({}), key)).toThrow(
      "reutilizat",
    );
    expect(() =>
      p.workCommand(db, owner, id, "cancel", { revision: 1, note: "again" }),
    ).toThrow("modificat");
  });
  it("rolls back the entire operation when the required audit fails", () => {
    const { id } = order();
    db.exec(
      "CREATE TRIGGER reject_audit BEFORE INSERT ON pro_audit_logs BEGIN SELECT RAISE(ABORT,'test audit failure'); END",
    );
    expect(() => cmd(owner, id, "cancel", { note: "Test" })).toThrow();
    expect(get(id).status).toBe("scheduled");
  });
  it("does not allow edits or deletion of audit rows", () => {
    expect(() =>
      db.prepare("UPDATE pro_audit_logs SET action=?").run("changed"),
    ).toThrow("append-only");
    expect(() => db.exec("DELETE FROM pro_audit_logs")).toThrow("append-only");
  });
  it("generates recurring work once on retry and pauses future generation", () => {
    const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    p.createRecurring(db, owner, {
      property_id: prop,
      title: "Recurent",
      service: "cleaning_recurring",
      frequency: "weekly",
      start_date: start,
      hour: 12,
      duration: 60,
      estimate: 500,
    });
    const first = p.runRecurring(db);
    expect(first.generated).toBeGreaterThan(0);
    expect(p.runRecurring(db).generated).toBe(0);
    db.exec("UPDATE pro_recurring_rules SET active=0");
    expect(p.runRecurring(db, Date.now() + 30 * 86400000).generated).toBe(0);
  });
  it("enforces property-scoped viewer access without finance privileges", () => {
    db.prepare(
      "INSERT INTO pro_members VALUES('viewer',?,'stranger','viewer',?,1)",
    ).run(org, JSON.stringify([otherProp]));
    expect(p.collection(db, stranger, org, "properties")).toEqual([]);
    expect(() => p.property(db, stranger, prop)).toThrow();
    expect(() => p.collection(db, stranger, org, "costs")).toThrow();
  });
  it("encrypts access codes and refuses access outside work window", () => {
    process.env.NITIDO_PRO_ACCESS_KEY = "a".repeat(64);
    const id = accepted();
    p.saveCredential(db, owner, prop, { secret: "PRIVATE-123" });
    const row = db
      .prepare("SELECT ciphertext FROM pro_access_credentials")
      .get() as { ciphertext: string };
    expect(row.ciphertext).not.toContain("PRIVATE-123");
    expect(p.credential(db, partner, id)).toEqual({ secret: "PRIVATE-123" });
    db.prepare(
      "UPDATE pro_work_orders SET ends_at='2000-01-01' WHERE id=?",
    ).run(id);
    expect(() => p.credential(db, partner, id)).toThrow("interval");
    delete process.env.NITIDO_PRO_ACCESS_KEY;
  });
  it("escapes CSV formulas and quotes", () => {
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});

describe('recurring storage integrity',()=>{
 function rule(){return p.createRecurring(db,owner,{property_id:prop,title:'Recurență verificată',service:'cleaning_recurring',frequency:'weekly',start_date:new Date(Date.now()+86400000).toISOString().slice(0,10),hour:12,duration:60,estimate:500});}
 it.each(['pro_occurrences','pro_audit_logs','pro_work_orders'])('rolls back storage failure in %s and retries without orphan work',table=>{
  const r=rule();const before=db.prepare('SELECT next_date FROM pro_recurring_rules WHERE id=?').get(r.id);const auditCount=db.prepare('SELECT COUNT(*) n FROM pro_audit_logs').get();
  db.exec(`CREATE TRIGGER fail_recurring BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END;`);
  expect(()=>p.runRecurring(db)).toThrow('simulated storage failure');
  expect(db.prepare('SELECT * FROM pro_work_orders').all()).toEqual([]);expect(db.prepare('SELECT * FROM pro_occurrences').all()).toEqual([]);expect(db.prepare('SELECT * FROM pro_approvals').all()).toEqual([]);expect(db.prepare('SELECT next_date FROM pro_recurring_rules WHERE id=?').get(r.id)).toEqual(before);expect(db.prepare('SELECT COUNT(*) n FROM pro_audit_logs').get()).toEqual(auditCount);
  db.exec('DROP TRIGGER fail_recurring');const result=p.runRecurring(db);expect(result.generated).toBeGreaterThan(0);expect(db.prepare('SELECT COUNT(*) n FROM pro_work_orders').get()).toEqual({n:result.generated});expect(p.runRecurring(db).generated).toBe(0);
 });
 it('keeps a genuine past occurrence missed without creating a late job',()=>{
  rule();const result=p.runRecurring(db,Date.now()+3*86400000);expect(result.missed).toBe(1);expect(db.prepare("SELECT * FROM pro_occurrences WHERE status='missed'").all()).toHaveLength(1);
 });
});
describe('Pro collection financial scope',()=>{
 it('does not let an unrestricted viewer membership widen scoped manager or approver access',()=>{
  const second=p.createProperty(db,owner,{organization_id:org,name:'Apartament C',city:'Constanța',address:'Privat C'}).id;
  db.prepare("INSERT INTO pro_members VALUES('manager-limited',?,'stranger','manager',?,1)").run(org,JSON.stringify([prop]));
  db.prepare("INSERT INTO pro_members VALUES('viewer-all',?,'stranger','viewer','[]',1)").run(org);
  db.prepare("INSERT INTO pro_members VALUES('approver-limited',?,'stranger','approver',?,1)").run(org,JSON.stringify([prop]));
  const add=db.prepare("INSERT INTO pro_cost_entries(id,organization_id,property_id,category,amount,created_at) VALUES(?,?,?,'service',500,?)");
  for(const [id,property] of [['allowed',prop],['hidden',second],['org-only',null]])add.run(id,org,property,new Date().toISOString());
  expect(p.collection(db,stranger,org,'costs')).toMatchObject([{id:'allowed'}]);expect(p.collection(db,owner,org,'costs')).toHaveLength(3);
  order();run(owner,{},()=>p.createWork(db,owner,{property_id:second,title:'Altă proprietate',service:'cleaning_recurring',starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+7200000).toISOString(),estimate:1000}));
  expect(p.collection(db,stranger,org,'approvals')).toMatchObject([{property_id:prop}]);expect(p.collection(db,owner,org,'approvals')).toHaveLength(2);
  for(const property_id of [prop,second])p.createRecurring(db,owner,{property_id,title:'Recurență',service:'cleaning_recurring',frequency:'weekly',start_date:new Date(Date.now()+86400000).toISOString().slice(0,10),hour:12,duration:60,estimate:500});
  expect(p.collection(db,stranger,org,'recurring')).toMatchObject([{property_id:prop}]);expect(p.collection(db,stranger,org,'properties')).toHaveLength(2);
 });
});
