import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { migratePro, PRO_SCHEMA, PRO_CHECKLIST_SCHEMA, PRO_PHOTO_RULES_SCHEMA } from "./schema";
import * as pro from "./core";
import { bucharestDateKey } from "../scheduling";

let db: Database.Database, org: string, property: string;
const owner = { id: "owner" }, admin = { id: "admin", admin: true };
const service = "cleaning_recurring";
function rule(overrides: Record<string, unknown> = {}) {
  const body = { property_id: property, title: "Curățenie zilnică", service, frequency: "daily", start_date: "2027-01-02", hour: 12, duration: 60, estimate: 0, ...overrides };
  return pro.atomic(db, owner, crypto.randomUUID(), body, () => pro.createRecurring(db, owner, body)) as { id: string };
}
const occurrences = () => db.prepare("SELECT day,status,work_order_id FROM pro_occurrences ORDER BY day").all() as { day: string; status: string; work_order_id: string | null }[];
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
  db = new Database(":memory:"); db.pragma("foreign_keys=ON");
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT); INSERT INTO users VALUES('owner','Owner','owner@example.test')");
  migratePro(db);
  org = pro.createOrg(db, admin, { name: "Zilnic", city: "Iași", owner_id: owner.id, contract_ref: "test" }).id;
  property = pro.createProperty(db, owner, { organization_id: org, name: "Birou", city: "Iași", address: "Adresă test" }).id;
  db.prepare("UPDATE pro_organizations SET status='active'").run();
});
afterEach(() => { db.close(); vi.useRealTimers(); });

describe("Pro daily recurrence and additive migration 14", () => {
  it("preserves provider tables while detecting only literal legacy pro_ tables", () => {
    const fresh = new Database(":memory:");
    fresh.exec("CREATE TABLE provider_invitations(id TEXT PRIMARY KEY); INSERT INTO provider_invitations VALUES('retained'); CREATE TABLE provider_score_policies(id TEXT PRIMARY KEY); INSERT INTO provider_score_policies VALUES('score-retained')");
    migratePro(fresh);
    expect(fresh.prepare("SELECT * FROM provider_invitations").all()).toEqual([{ id: "retained" }]);
    expect(fresh.prepare("SELECT * FROM provider_score_policies").all()).toEqual([{ id: "score-retained" }]);
    fresh.close();
    const legacy = new Database(":memory:");
    legacy.exec("CREATE TABLE pro_legacy(id TEXT PRIMARY KEY); INSERT INTO pro_legacy VALUES('retained')");
    expect(() => migratePro(legacy)).toThrow("Legacy Pro");
    expect(legacy.prepare("SELECT * FROM pro_legacy").all()).toEqual([{ id: "retained" }]);
    legacy.close();
  });
  it("migrates fresh and existing v13 data idempotently without rewriting historical rows", () => {
    const old = new Database(":memory:"); old.pragma("foreign_keys=ON");
    old.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT); INSERT INTO users VALUES('owner','Owner','owner@example.test'); CREATE TABLE marketplace_sentinel(value TEXT); INSERT INTO marketplace_sentinel VALUES('preserved')");
    old.exec(PRO_SCHEMA); old.exec(PRO_CHECKLIST_SCHEMA); old.exec(PRO_PHOTO_RULES_SCHEMA);
    const legacyOrg = pro.createOrg(old, admin, { name: "Legacy", city: "Iași", owner_id: owner.id, contract_ref: "test" }).id;
    const legacyProperty = pro.createProperty(old, owner, { organization_id: legacyOrg, name: "Legacy", city: "Iași", address: "test" }).id;
    old.exec("UPDATE pro_organizations SET status='active'");
    pro.createRecurring(old, owner, { property_id: legacyProperty, title: "Săptămânal", service, frequency: "weekly", start_date: "2027-01-02", hour: 12, duration: 60, estimate: 0 });
    pro.runRecurring(old);
    const tables = ["pro_recurring_rules", "pro_occurrences", "pro_work_orders", "pro_work_photo_rules", "pro_audit_logs", "marketplace_sentinel"];
    const before = tables.map(t => old.prepare(`SELECT * FROM ${t}`).all());
    migratePro(old); migratePro(old);
    expect(tables.map(t => old.prepare(`SELECT * FROM ${t}`).all())).toEqual(before);
    expect(old.prepare("SELECT * FROM pro_recurring_cadences").all()).toEqual([]);
    expect(old.prepare("SELECT version FROM pro_schema_migrations ORDER BY version").all()).toEqual([11, 12, 13, 14].map(version => ({ version })));
    old.close();
    expect(db.prepare("SELECT MAX(version) AS version FROM pro_schema_migrations").get()).toEqual({ version: 14 });
  });
  it("requires migration 14 for daily while preserving weekly on older schemas", () => {
    db.exec("DROP TRIGGER pro_daily_legacy_inactive; DROP TABLE pro_recurring_cadences; DELETE FROM pro_schema_migrations WHERE version=14");
    expect(() => rule()).toThrow("migrarea");
    rule({ frequency: "weekly" }); expect(pro.runRecurring(db).generated).toBe(2);
    expect(pro.collection(db, owner, org, "recurring")).toMatchObject([{ frequency: "weekly", active: 1 }]);
  });
  it("generates every local day once and keeps older schedulers from executing daily rules", () => {
    const { id } = rule({ end_date: "2027-01-05" });
    expect(db.prepare("SELECT frequency,active FROM pro_recurring_rules WHERE id=?").get(id)).toEqual({ frequency: "weekly", active: 0 });
    expect(() => db.prepare("UPDATE pro_recurring_rules SET active=1 WHERE id=?").run(id)).toThrow("revision 14");
    expect(pro.collection(db, owner, org, "recurring")).toMatchObject([{ id, frequency: "daily", active: 1, end_date: "2027-01-05" }]);
    expect(pro.runRecurring(db)).toMatchObject({ generated: 4, missed: 0 });
    expect(occurrences().map(o => o.day)).toEqual(["2027-01-02", "2027-01-03", "2027-01-04", "2027-01-05"]);
    const first = occurrences(); expect(pro.runRecurring(db).generated).toBe(0); expect(occurrences()).toEqual(first);
  });
  it("replays a create command without duplicating either the daily cadence or its audit", () => {
    const body = { property_id: property, title: "Reîncercare", service, frequency: "daily", start_date: "2027-01-02", hour: 12, duration: 60, estimate: 0 };
    const key = crypto.randomUUID(), command = () => pro.createRecurring(db, owner, body);
    const first = pro.atomic(db, owner, key, body, command);
    expect(pro.atomic(db, owner, key, body, command)).toEqual(first);
    expect(db.prepare("SELECT COUNT(*) n FROM pro_recurring_cadences").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) n FROM pro_audit_logs WHERE action='recurring.created'").get()).toEqual({ n: 1 });
  });
  it("pauses future generation and resumes without changing already generated work", () => {
    const { id } = rule({ end_date: "2027-01-20" });
    pro.setRecurringActive(db, id, false); expect(pro.runRecurring(db).generated).toBe(0);
    pro.setRecurringActive(db, id, true); expect(pro.runRecurring(db).generated).toBe(14);
    const works = db.prepare("SELECT * FROM pro_work_orders ORDER BY starts_at").all();
    pro.setRecurringActive(db, id, false); vi.setSystemTime(new Date("2027-01-05T00:00:00Z"));
    expect(pro.runRecurring(db).generated).toBe(0); expect(db.prepare("SELECT * FROM pro_work_orders ORDER BY starts_at").all()).toEqual(works);
    pro.setRecurringActive(db, id, true); expect(pro.runRecurring(db).generated).toBe(4);
    pro.pausePropertyRecurring(db, property); expect(pro.collection(db, owner, org, "recurring")).toMatchObject([{ active: 0 }]);
    expect(pro.runRecurring(db).generated).toBe(0);
  });
  it.each(["2027-01-01", "2027-02-30", "2027-01-02T12:00:00Z"])("rejects invalid end_date %s before creating anything", end_date => {
    expect(() => rule({ end_date })).toThrow("Ultima zi");
    expect(db.prepare("SELECT * FROM pro_recurring_rules").all()).toEqual([]);
  });
  it("honors skipped appearances and the inclusive end date", () => {
    const { id } = rule({ end_date: "2027-01-04" });
    db.prepare("INSERT INTO pro_occurrences VALUES(?,?,NULL,'skipped')").run(id, "2027-01-03");
    expect(pro.runRecurring(db)).toMatchObject({ generated: 2, missed: 0 });
    expect(occurrences().map(o => [o.day, o.status])).toEqual([["2027-01-02", "generated"], ["2027-01-03", "skipped"], ["2027-01-04", "generated"]]);
  });
  it.each(["pro_work_orders", "pro_occurrences", "pro_work_photo_rules", "pro_audit_logs", "pro_approvals"])("rolls back generation after %s storage failure, then retries once", table => {
    const { id } = rule({ estimate: 100, end_date: "2027-01-04" });
    const before = db.prepare("SELECT next_date FROM pro_recurring_rules WHERE id=?").get(id);
    const audits = db.prepare("SELECT * FROM pro_audit_logs").all();
    db.exec(`CREATE TRIGGER fail_daily BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'daily storage failure'); END`);
    expect(() => pro.runRecurring(db)).toThrow("daily storage failure");
    expect(db.prepare("SELECT * FROM pro_work_orders").all()).toEqual([]); expect(occurrences()).toEqual([]);
    expect(db.prepare("SELECT * FROM pro_audit_logs").all()).toEqual(audits);
    expect(db.prepare("SELECT next_date FROM pro_recurring_rules WHERE id=?").get(id)).toEqual(before);
    db.exec("DROP TRIGGER fail_daily"); expect(pro.runRecurring(db).generated).toBe(3); expect(pro.runRecurring(db).generated).toBe(0);
  });
  it("rolls back both the daily cadence and its legacy row when creation audit fails", () => {
    db.exec("CREATE TRIGGER fail_create BEFORE INSERT ON pro_audit_logs BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
    expect(() => rule()).toThrow("audit unavailable");
    expect(db.prepare("SELECT * FROM pro_recurring_rules").all()).toEqual([]);
    expect(db.prepare("SELECT * FROM pro_recurring_cadences").all()).toEqual([]);
  });
  it("rolls back migration 14 fully if the migration marker cannot be saved", () => {
    db.exec("DROP TRIGGER pro_daily_legacy_inactive; DROP TABLE pro_recurring_cadences; DELETE FROM pro_schema_migrations WHERE version=14; CREATE TRIGGER fail_migration BEFORE INSERT ON pro_schema_migrations WHEN NEW.version=14 BEGIN SELECT RAISE(ABORT,'migration marker unavailable'); END");
    expect(() => migratePro(db)).toThrow("migration marker unavailable");
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='pro_recurring_cadences'").get()).toBeUndefined();
    expect(db.prepare("SELECT version FROM pro_schema_migrations ORDER BY version").all()).toEqual([11, 12, 13].map(version => ({ version })));
    db.exec("DROP TRIGGER fail_migration"); migratePro(db);
    expect(db.prepare("SELECT version FROM pro_schema_migrations ORDER BY version").all()).toEqual([11, 12, 13, 14].map(version => ({ version })));
  });
  it.each([{ start: "2027-03-27", end: "2027-03-29", stamp: "2027-03-26", hours: [24, 23] }, { start: "2027-10-30", end: "2027-11-01", stamp: "2027-10-29", hours: [24, 25] }])("keeps the same Romanian local hour across DST: $start", ({ start, end, stamp, hours }) => {
    vi.setSystemTime(new Date(stamp + "T00:00:00Z")); rule({ start_date: start, end_date: end, hour: 1 });
    expect(pro.runRecurring(db).generated).toBe(3);
    const works = db.prepare("SELECT starts_at FROM pro_work_orders ORDER BY starts_at").all() as { starts_at: string }[];
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", hourCycle: "h23" });
    expect(works.map(w => local.format(new Date(w.starts_at)))).toEqual(["01", "01", "01"]);
    expect(works.slice(1).map((w, i) => (Date.parse(w.starts_at) - Date.parse(works[i].starts_at)) / 3600000)).toEqual(hours);
    expect(works.map(w => bucharestDateKey(new Date(w.starts_at)))).toEqual(occurrences().map(o => o.day));
  });
  it("marks the daily spring gap for review once and continues to the next local day", () => {
    vi.setSystemTime(new Date("2027-03-26T00:00:00Z")); rule({ start_date: "2027-03-27", end_date: "2027-03-29", hour: 3 });
    expect(pro.runRecurring(db)).toMatchObject({ generated: 2, missed: 1 });
    expect(occurrences().map(o => [o.day, o.status])).toEqual([["2027-03-27", "generated"], ["2027-03-28", "missed"], ["2027-03-29", "generated"]]);
    expect(pro.runRecurring(db)).toMatchObject({ generated: 0, missed: 0 });
  });
  it("freezes each work's checklist and photo policy while future daily visits use new revisions", () => {
    const publish = (revision: number, items: string[], arrivalMin: number, completionMin: number) => {
      const body = { service, revision, items, reason: "Dovezi proprietate", photoRules: { arrivalMin, completionMin } };
      pro.atomic(db, owner, crypto.randomUUID(), body, () => pro.savePropertyChecklist(db, owner, property, body));
    };
    publish(0, ["Living"], 1, 2); rule({ end_date: "2027-01-20" }); pro.runRecurring(db);
    const original = db.prepare("SELECT id,checklist_json FROM pro_work_orders ORDER BY starts_at").all() as { id: string; checklist_json: string }[];
    publish(1, ["Living", "Balcon"], 2, 3); expect(pro.runRecurring(db).generated).toBe(0);
    vi.setSystemTime(new Date("2027-01-08T00:00:00Z")); expect(pro.runRecurring(db).generated).toBe(5);
    for (const w of original) {
      expect(JSON.parse(w.checklist_json)).toEqual(["Living"]);
      expect(pro.workPhotoRules(db, w.id)).toEqual({ arrivalMin: 1, completionMin: 2 });
      expect(db.prepare("SELECT checklist_json FROM pro_work_orders WHERE id=?").get(w.id)).toEqual({ checklist_json: w.checklist_json });
    }
    const latest = occurrences().at(-1)!;
    expect(db.prepare("SELECT checklist_json FROM pro_work_orders WHERE id=?").get(latest.work_order_id)).toEqual({ checklist_json: '["Living","Balcon"]' });
    expect(pro.workPhotoRules(db, latest.work_order_id!)).toEqual({ arrivalMin: 2, completionMin: 3 });
  });
});
