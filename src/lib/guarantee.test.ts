import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import { requestReclean, isWithinGuaranteeWindow, GUARANTEE_WINDOW_HOURS } from "./guarantee";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

const NOW = new Date("2026-03-10T12:00:00Z");

function seed(db: Database): void {
  db.prepare("INSERT INTO users (id, role, name) VALUES ('client_1','client','C')").run();
  db.prepare("INSERT INTO users (id, role, name) VALUES ('fu','firma','F')").run();
  db.prepare("INSERT INTO firms (id, user_id, coverage_city, verified) VALUES ('firm_1','fu','Constanța',1)").run();
}

function seedCompleted(db: Database, id: string, completedAt: string): void {
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status, accepted_firm_id, completed_at)
     VALUES (?, 'client_1', 'Str. Test 1', 'Constanța', 75, 'apartament', 'asap', 550, 150, 'completed', 'firm_1', ?)`
  ).run(id, completedAt);
}

describe("guarantee — Nitido Guaranteed (re-curățare gratuită)", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
    seed(db);
  });

  it("isWithinGuaranteeWindow: în interval / în afara intervalului / null", () => {
    const within = new Date(NOW.getTime() - 3600 * 1000).toISOString(); // acum 1h
    const beyond = new Date(NOW.getTime() - (GUARANTEE_WINDOW_HOURS + 1) * 3600 * 1000).toISOString();
    expect(isWithinGuaranteeWindow(within, NOW)).toBe(true);
    expect(isWithinGuaranteeWindow(beyond, NOW)).toBe(false);
    expect(isWithinGuaranteeWindow(null, NOW)).toBe(false);
  });

  it("creează re-curățarea gratuită, alocată aceleiași firme, preț 0", () => {
    seedCompleted(db, "job_1", new Date(NOW.getTime() - 3600 * 1000).toISOString());
    const r = requestReclean(db, "job_1", "client_1", NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nj = db.prepare("SELECT * FROM jobs WHERE id = ?").get(r.jobId) as { guarantee_of: string; accepted_firm_id: string; status: string; price_gross: number };
    expect(nj.guarantee_of).toBe("job_1");
    expect(nj.accepted_firm_id).toBe("firm_1");
    expect(nj.status).toBe("accepted");
    expect(nj.price_gross).toBe(0);
  });

  it("respinge dacă lucrarea nu e finalizată", () => {
    db.prepare("INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status) VALUES ('job_w','client_1','S','Constanța',75,'apartament','asap',550,150,'waiting')").run();
    expect(requestReclean(db, "job_w", "client_1", NOW)).toMatchObject({ ok: false, status: 409 });
  });

  it("respinge alt client (403)", () => {
    seedCompleted(db, "job_1", new Date(NOW.getTime() - 3600 * 1000).toISOString());
    db.prepare("INSERT INTO users (id, role, name) VALUES ('client_2','client','X')").run();
    expect(requestReclean(db, "job_1", "client_2", NOW)).toMatchObject({ ok: false, status: 403 });
  });

  it("respinge după expirarea ferestrei de garanție", () => {
    seedCompleted(db, "job_1", new Date(NOW.getTime() - (GUARANTEE_WINDOW_HOURS + 2) * 3600 * 1000).toISOString());
    expect(requestReclean(db, "job_1", "client_1", NOW)).toMatchObject({ ok: false, status: 409 });
  });

  it("nu permite două re-curățări pentru aceeași lucrare", () => {
    seedCompleted(db, "job_1", new Date(NOW.getTime() - 3600 * 1000).toISOString());
    expect(requestReclean(db, "job_1", "client_1", NOW).ok).toBe(true);
    expect(requestReclean(db, "job_1", "client_1", NOW)).toMatchObject({ ok: false, status: 409 });
  });

  it("o re-curățare nu poate fi ea însăși re-curățată", () => {
    seedCompleted(db, "job_1", new Date(NOW.getTime() - 3600 * 1000).toISOString());
    const r = requestReclean(db, "job_1", "client_1", NOW);
    if (!r.ok) throw new Error("setup");
    // marcăm re-curățarea ca finalizată recent și încercăm din nou
    db.prepare("UPDATE jobs SET status='completed', completed_at=? WHERE id=?").run(new Date(NOW.getTime() - 1800 * 1000).toISOString(), r.jobId);
    expect(requestReclean(db, r.jobId, "client_1", NOW)).toMatchObject({ ok: false, status: 409 });
  });
});
