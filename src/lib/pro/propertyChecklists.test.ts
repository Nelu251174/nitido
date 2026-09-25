import { beforeEach, afterEach, it, expect } from "vitest";
import Database from "better-sqlite3";
import { migratePro, PRO_SCHEMA } from "./schema";
import * as p from "./core";
import { CHECKLISTS } from "./shared";
let db: Database.Database;
let property: string;
let org: string;
const admin = { id: "admin", admin: true }, owner = { id: "owner" }, member = { id: "member" };
const service = "cleaning_recurring";
function publish(revision = 0, items = ["Verifică livingul"], who = owner) {
  const body = { service, revision, items, reason: "Cerință specifică proprietății" };
  return p.atomic(db, who, crypto.randomUUID(), body, () => p.savePropertyChecklist(db, who, property, body));
}
function work(days = 1) {
  return p.atomic(db, owner, crypto.randomUUID(), { days }, () => p.createWork(db, owner, {
    property_id: property, title: "Lucrare", service, estimate: 0,
    starts_at: new Date(Date.now() + days * 86400000).toISOString(),
    ends_at: new Date(Date.now() + days * 86400000 + 3600000).toISOString(),
  })) as { id: string };
}
beforeEach(() => {
  db = new Database(":memory:"); db.pragma("foreign_keys=ON");
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT); INSERT INTO users VALUES('owner','Owner','owner@example.test'),('member','Member','member@example.test')");
  migratePro(db);
  org = p.createOrg(db, admin, { name: "A", city: "Iași", owner_id: owner.id, contract_ref: "test" }).id;
  property = p.createProperty(db, owner, { organization_id: org, name: "A1", city: "Iași", address: "test" }).id;
  db.prepare("UPDATE pro_organizations SET status='active'").run();
});
afterEach(() => db.close());
it("upgrades v11 additively and idempotently, preserving existing tables and rows", () => {
  const old = new Database(":memory:");
  old.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('marketplace-client')"); old.exec(PRO_SCHEMA);
  old.exec("CREATE TABLE marketplace_sentinel(value TEXT); INSERT INTO marketplace_sentinel VALUES('preserved')");
  expect(p.checklistConfigurationReady(old)).toBe(false);
  expect(p.propertyChecklist(old, "any", service).items).toEqual(CHECKLISTS[service]);
  const legacyOrg = p.createOrg(old, admin, { name: "Old", city: "Iași", owner_id: "marketplace-client", contract_ref: "old" }).id;
  const legacyProperty = p.createProperty(old, { id: "marketplace-client" }, { organization_id: legacyOrg, name: "Old", city: "Iași", address: "old" }).id;
  old.prepare("UPDATE pro_organizations SET status='active'").run();
  p.createWork(old, { id: "marketplace-client" }, { property_id: legacyProperty, service, title: "Existing", estimate: 0, starts_at: new Date(Date.now() + 86400000).toISOString(), ends_at: new Date(Date.now() + 90000000).toISOString() });
  const existingWorks = old.prepare("SELECT * FROM pro_work_orders").all();
  migratePro(old); migratePro(old);
  expect(old.prepare("SELECT * FROM pro_work_orders").all()).toEqual(existingWorks);
  expect(old.prepare("SELECT version FROM pro_schema_migrations ORDER BY version").all()).toEqual([{ version: 11 }, { version: 12 }, { version: 13 }]);
  expect(old.prepare("SELECT value FROM marketplace_sentinel").get()).toEqual({ value: "preserved" });
  expect(old.prepare("SELECT id FROM users").get()).toEqual({ id: "marketplace-client" }); old.close();
});
it("freezes existing work and uses new revisions only for future work with an audit reference", () => {
  const first = work(); publish(); const second = work(2); publish(1, ["Verifică balconul"]); const third = work(3);
  const snapshot = (id: string) => JSON.parse((db.prepare("SELECT checklist_json FROM pro_work_orders WHERE id=?").get(id) as { checklist_json: string }).checklist_json);
  expect(snapshot(first.id)).toEqual(CHECKLISTS[service]); expect(snapshot(second.id)).toEqual(["Verifică livingul"]); expect(snapshot(third.id)).toEqual(["Verifică balconul"]);
  const audit = db.prepare("SELECT details_json FROM pro_audit_logs WHERE entity_id=? AND action='work.created'").get(second.id) as { details_json: string };
  expect(JSON.parse(audit.details_json)).toMatchObject({ checklist_revision: 1, checklist_service: service });
  expect(p.propertyChecklist(db, property, "property_check").revision).toBe(0);
});
it("rejects a competing stale publication and keeps immutable versions", () => {
  publish(); expect(() => publish()).toThrow("modificată");
  expect(p.propertyChecklist(db, property, service).revision).toBe(1);
  expect(() => db.prepare("UPDATE pro_property_checklists SET reason='changed'").run()).toThrow("append-only");
  expect(() => db.prepare("DELETE FROM pro_property_checklists").run()).toThrow("append-only");
});
it("rolls back publication if audit persistence fails", () => {
  db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON pro_audit_logs BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  expect(() => publish()).toThrow("audit unavailable");
  expect(p.propertyChecklist(db, property, service).revision).toBe(0);
});
it.each(["viewer", "approver", "contact"])("denies %s editing and configuration history", role => {
  db.prepare("INSERT INTO pro_members VALUES('member',?,?,?,'[]',1)").run(org, member.id, role);
  expect(() => publish(0, ["A"], member)).toThrow("Acces interzis");
  expect(() => p.propertyChecklistConfiguration(db, member, property)).toThrow("Acces interzis");
  expect(() => p.propertyChecklistHistory(db, member, property, service, 100)).toThrow("Acces interzis");
});
it.each(["manager", "operator"])("permits %s only in the authorized property scope", role => {
  db.prepare("INSERT INTO pro_members VALUES('member',?,?,?, ?,1)").run(org, member.id, role, JSON.stringify([property]));
  publish(0, ["A"], member);
  const other = p.createProperty(db, owner, { organization_id: org, name: "B", city: "Iași", address: "B" }).id;
  expect(() => p.propertyChecklistConfiguration(db, member, other)).toThrow("Acces interzis");
  expect(() => p.atomic(db, member, crypto.randomUUID(), {}, () => p.savePropertyChecklist(db, member, other, { service, revision: 0, items: ["A"], reason: "R" }))).toThrow("Acces interzis");
  db.prepare("UPDATE pro_members SET active=0 WHERE id='member'").run();
  expect(() => p.propertyChecklistHistory(db, member, property, service, 100)).toThrow("Acces interzis");
});
it.each([[], [""], ["A", " a "], Array(41).fill("A"), ["X".repeat(301)]].map(items => ({ items })))("rejects invalid task lists %#", ({ items }) => {
  expect(() => publish(0, items)).toThrow(); expect(p.propertyChecklist(db, property, service).revision).toBe(0);
});
it("rejects prototype service names and requires a transaction", () => {
  expect(() => p.propertyChecklist(db, property, "toString")).toThrow("Serviciu");
  expect(() => p.savePropertyChecklist(db, owner, property, {})).toThrow("atomic transaction");
});
it("paginates all history without loss and preserves publication identity", () => {
  for (let i = 0; i < 23; i++) publish(i, ["Punct " + i]);
  const first = p.propertyChecklistHistory(db, owner, property, service, Number.MAX_SAFE_INTEGER);
  expect(first.rows).toHaveLength(20); expect(first.next).toBe(4);
  const second = p.propertyChecklistHistory(db, owner, property, service, first.next!);
  expect(second.rows.map(r => r.revision)).toEqual([3, 2, 1]); expect(second.next).toBeNull();
  expect(second.rows[2]).toMatchObject({ actor: "owner", items: ["Punct 0"], reason: "Cerință specifică proprietății" });
});
it("recurring generation captures the current checklist and retry preserves the snapshot", () => {
  publish();
  p.createRecurring(db, owner, { property_id: property, title: "Recurență", service, frequency: "weekly", start_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), hour: 12, duration: 60, estimate: 0 });
  expect(p.runRecurring(db).generated).toBeGreaterThan(0);
  const original = db.prepare("SELECT id,checklist_json FROM pro_work_orders ORDER BY id").all();
  expect(original).not.toHaveLength(0);
  for (const row of original as { checklist_json: string }[]) expect(JSON.parse(row.checklist_json)).toEqual(["Verifică livingul"]);
  publish(1, ["Noua cerință"]); expect(p.runRecurring(db).generated).toBe(0);
  expect(db.prepare("SELECT id,checklist_json FROM pro_work_orders ORDER BY id").all()).toEqual(original);
});

it("snapshots photo requirements per service, preserves existing works and audits each revision", () => {
  const first = work();
  const body = { service, revision: 0, items: ["Verifică livingul"], reason: "Dovezi pentru această proprietate", photoRules: { arrivalMin: 2, completionMin: 3 } };
  p.atomic(db, owner, crypto.randomUUID(), body, () => p.savePropertyChecklist(db, owner, property, body));
  const second = work(2);
  expect(p.workPhotoRules(db, first.id)).toEqual({ arrivalMin: 0, completionMin: 1 });
  expect(p.workPhotoRules(db, second.id)).toEqual(body.photoRules);
  publish(1); // Publishing checklist text without photo fields preserves the policy.
  expect(p.propertyChecklist(db, property, service).photoRules).toEqual(body.photoRules);
  expect(p.propertyChecklistHistory(db, owner, property, service, 100).rows[1].photoRules).toEqual(body.photoRules);
  expect(p.propertyChecklist(db, property, "property_check").photoRules).toEqual({ arrivalMin: 0, completionMin: 1 });
  expect(() => db.exec("UPDATE pro_work_photo_rules SET completion_min=1")).toThrow("immutable");
  expect(() => db.exec("DELETE FROM pro_property_photo_rules")).toThrow("retained");
  const invalid = { ...body, revision: 2, photoRules: { arrivalMin: 15, completionMin: 10 } };
  expect(() => p.atomic(db, owner, crypto.randomUUID(), invalid, () => p.savePropertyChecklist(db, owner, property, invalid))).toThrow("maximum 20");
  expect(p.propertyChecklist(db, property, service).revision).toBe(2);
});
