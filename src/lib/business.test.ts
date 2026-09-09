import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import { setBusinessProfile, getBusinessProfile, executionReport } from "./business";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seed(db: Database): void {
  db.prepare("INSERT INTO users (id, role, name) VALUES ('client_1','client','C')").run();
  db.prepare("INSERT INTO users (id, role, name) VALUES ('fu','firma','Sparkle SRL')").run();
  db.prepare("INSERT INTO firms (id, user_id, coverage_city, verified) VALUES ('firm_1','fu','Constanța',1)").run();
}

function seedCompleted(db: Database, id: string, price: number, completedAt: string): void {
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status, accepted_firm_id, completed_at)
     VALUES (?, 'client_1', 'Str. Biz 1', 'Constanța', 120, 'birou', 'asap', ?, 200, 'completed', 'firm_1', ?)`
  ).run(id, price, completedAt);
}

describe("business — Nitido Office (cont business + raport execuție)", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
    seed(db);
  });

  it("activează contul business cu datele firmei", () => {
    const r = setBusinessProfile(db, "client_1", { companyName: "ACME SRL", companyCui: "RO123", companyAddress: "Bd. Mamaia 1" });
    expect(r.ok).toBe(true);
    const p = getBusinessProfile(db, "client_1");
    expect(p.isBusiness).toBe(true);
    expect(p.companyName).toBe("ACME SRL");
    expect(p.companyCui).toBe("RO123");
  });

  it("respinge dacă lipsește numele sau CUI-ul", () => {
    expect(setBusinessProfile(db, "client_1", { companyName: "", companyCui: "RO1" })).toMatchObject({ ok: false, status: 400 });
    expect(setBusinessProfile(db, "client_1", { companyName: "ACME", companyCui: "" })).toMatchObject({ ok: false, status: 400 });
  });

  it("raportul de execuție listează lucrările finalizate cu totaluri", () => {
    seedCompleted(db, "j1", 500, "2026-03-05T10:00:00Z");
    seedCompleted(db, "j2", 700, "2026-03-20T10:00:00Z");
    seedCompleted(db, "j3", 300, "2026-04-02T10:00:00Z");

    const all = executionReport(db, "client_1");
    expect(all.totalJobs).toBe(3);
    expect(all.totalAmount).toBe(1500);
    expect(all.rows[0].firmName).toBe("Sparkle SRL");

    const march = executionReport(db, "client_1", "2026-03");
    expect(march.totalJobs).toBe(2);
    expect(march.totalAmount).toBe(1200);
  });

  it("raportul nu include lucrări neterminate", () => {
    seedCompleted(db, "j1", 500, "2026-03-05T10:00:00Z");
    db.prepare("INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status) VALUES ('jw','client_1','S','Constanța',120,'birou','asap',400,200,'waiting')").run();
    const rep = executionReport(db, "client_1");
    expect(rep.totalJobs).toBe(1);
  });
});
