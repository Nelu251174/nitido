import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import { acceptJobAtomic } from "./acceptJob";
import { markNoShow } from "./noShow";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seedClientAndFirm(db: Database): string {
  db.prepare("INSERT INTO users (id, role, name) VALUES ('client_1','client','Test Client')").run();
  db.prepare("INSERT INTO users (id, role, name) VALUES ('firm_user_1','firma','Firma 1')").run();
  db.prepare(
    "INSERT INTO firms (id, user_id, coverage_city, verified) VALUES ('firm_1', 'firm_user_1', 'Constanța', 1)"
  ).run();
  return "firm_1";
}

function seedJob(db: Database, id: string): void {
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status)
     VALUES (?, 'client_1', 'Str. Test 1', 'Constanța', 75, 'apartament', 'asap', 550, 150, 'waiting')`
  ).run(id);
}

describe("markNoShow — praguri și efecte (spec secțiunea 5b)", () => {
  let db: Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("prima abatere: avertisment, fără suspendare", async () => {
    const firmId = seedClientAndFirm(db);
    seedJob(db, "job_1");
    await acceptJobAtomic(db, "job_1", firmId);

    const result = await markNoShow(db, "job_1", false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.consequence).toBe("warning");

    const job = db.prepare("SELECT status FROM jobs WHERE id = ?").get("job_1") as {
      status: string;
    };
    expect(job.status).toBe("no_show");

    const firm = db.prepare("SELECT suspended_until FROM firms WHERE id = ?").get(firmId) as {
      suspended_until: string | null;
    };
    expect(firm.suspended_until).toBeNull();
  });

  it("a doua abatere în 30 de zile: suspendare temporară", async () => {
    const firmId = seedClientAndFirm(db);

    seedJob(db, "job_1");
    await acceptJobAtomic(db, "job_1", firmId);
    await markNoShow(db, "job_1", false);

    seedJob(db, "job_2");
    await acceptJobAtomic(db, "job_2", firmId);
    const result = await markNoShow(db, "job_2", false);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.consequence).toBe("suspend_7d");

    const firm = db.prepare("SELECT suspended_until FROM firms WHERE id = ?").get(firmId) as {
      suspended_until: string | null;
    };
    expect(firm.suspended_until).not.toBeNull();
  });

  it("anulează hold-ul de plată (fără refund) la no-show", async () => {
    const firmId = seedClientAndFirm(db);
    seedJob(db, "job_1");
    await acceptJobAtomic(db, "job_1", firmId);

    let payment = db.prepare("SELECT status FROM payments WHERE job_id = ?").get("job_1") as {
      status: string;
    };
    expect(payment.status).toBe("authorized");

    await markNoShow(db, "job_1", false);

    payment = db.prepare("SELECT status FROM payments WHERE job_id = ?").get("job_1") as {
      status: string;
    };
    expect(payment.status).toBe("cancelled");
  });

  it("cu repost=true, creează o nouă lucrare identică în starea 'waiting'", async () => {
    const firmId = seedClientAndFirm(db);
    seedJob(db, "job_1");
    await acceptJobAtomic(db, "job_1", firmId);

    const result = await markNoShow(db, "job_1", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.repostedJobId).not.toBeNull();
    const reposted = db
      .prepare("SELECT status, street, sqm FROM jobs WHERE id = ?")
      .get(result.repostedJobId) as { status: string; street: string; sqm: number };
    expect(reposted.status).toBe("waiting");
    expect(reposted.street).toBe("Str. Test 1");
    expect(reposted.sqm).toBe(75);
  });

  it("respinge marcarea no-show pe un job care nu e 'accepted'", async () => {
    seedClientAndFirm(db);
    seedJob(db, "job_1"); // rămâne 'waiting', nimeni nu a acceptat

    const result = await markNoShow(db, "job_1", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });
});
