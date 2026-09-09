import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import { rescueAcceptedJob } from "./jobRescue";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seed(db: Database): void {
  db.prepare("INSERT INTO users (id, role, name) VALUES ('client_1','client','C')").run();
  db.prepare("INSERT INTO users (id, role, name) VALUES ('fu','firma','F')").run();
  db.prepare("INSERT INTO firms (id, user_id, coverage_city, verified) VALUES ('firm_1','fu','Constanța',1)").run();
}

function seedAccepted(db: Database, id: string, mode: "express" | "standard"): void {
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, mode, status, accepted_firm_id, accepted_at)
     VALUES (?, 'client_1', 'Str. Test 1', 'Constanța', 75, 'apartament', 'asap', 550, 150, ?, 'accepted', 'firm_1', datetime('now'))`
  ).run(id, mode);
  db.prepare(
    "INSERT INTO payments (id, job_id, amount_gross, commission_amount, amount_net, status) VALUES (?, ?, 550, 99, 451, 'authorized')"
  ).run(`pay_${id}`, id);
}

describe("jobRescue — Job Rescue (repunere automată la renunțare)", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
    seed(db);
  });

  it("renunțarea eliberează plata, anulează originalul și repune o lucrare nouă (același mod)", async () => {
    seedAccepted(db, "job_1", "standard");
    const r = await rescueAcceptedJob(db, "job_1", "firm_1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const orig = db.prepare("SELECT status FROM jobs WHERE id='job_1'").get() as { status: string };
    expect(orig.status).toBe("cancelled");

    const pay = db.prepare("SELECT status FROM payments WHERE job_id='job_1'").get() as { status: string };
    expect(pay.status).toBe("cancelled");

    const nj = db.prepare("SELECT status, mode, accepted_firm_id, client_id FROM jobs WHERE id = ?").get(r.newJobId) as { status: string; mode: string; accepted_firm_id: string | null; client_id: string };
    expect(nj.status).toBe("waiting");
    expect(nj.mode).toBe("standard");
    expect(nj.accepted_firm_id).toBeNull();
    expect(nj.client_id).toBe("client_1");
  });

  it("păstrează modul express la repunere", async () => {
    seedAccepted(db, "job_e", "express");
    const r = await rescueAcceptedJob(db, "job_e", "firm_1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nj = db.prepare("SELECT mode FROM jobs WHERE id = ?").get(r.newJobId) as { mode: string };
    expect(nj.mode).toBe("express");
  });

  it("respinge dacă lucrarea nu e a firmei (403)", async () => {
    seedAccepted(db, "job_1", "express");
    db.prepare("INSERT INTO users (id, role, name) VALUES ('fu2','firma','F2')").run();
    db.prepare("INSERT INTO firms (id, user_id, coverage_city, verified) VALUES ('firm_2','fu2','Constanța',1)").run();
    expect(await rescueAcceptedJob(db, "job_1", "firm_2")).toMatchObject({ ok: false, status: 403 });
  });

  it("respinge dacă lucrarea nu e în starea acceptată (409)", async () => {
    db.prepare(
      "INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status) VALUES ('job_w','client_1','S','Constanța',75,'apartament','asap',550,150,'waiting')"
    ).run();
    expect(await rescueAcceptedJob(db, "job_w")).toMatchObject({ ok: false, status: 409 });
  });
});
