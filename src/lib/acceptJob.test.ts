import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import { acceptJobAtomic } from "./acceptJob";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seedClientAndFirms(db: Database, n: number): string[] {
  db.prepare("INSERT INTO users (id, role, name) VALUES ('client_1','client','Test Client')").run();
  const firmIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const userId = `firm_user_${i}`;
    const firmId = `firm_${i}`;
    db.prepare("INSERT INTO users (id, role, name) VALUES (?, 'firma', ?)").run(userId, `Firma ${i}`);
    db.prepare(
      "INSERT INTO firms (id, user_id, coverage_city, verified) VALUES (?, ?, 'Constanța', 1)"
    ).run(firmId, userId);
    firmIds.push(firmId);
  }
  return firmIds;
}

function seedWaitingJob(db: Database, id: string, priceGross = 550): void {
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status)
     VALUES (?, 'client_1', 'Str. Test 1', 'Constanța', 75, 'apartament', 'asap', ?, 150, 'waiting')`
  ).run(id, priceGross);
}

describe("acceptJobAtomic — mecanismul 'primul care apasă câștigă' (spec secțiunea 5)", () => {
  let db: Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("un singur accept reușește pe un job în așteptare", async () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedWaitingJob(db, "job_1");

    const result = await acceptJobAtomic(db, "job_1", firmId);
    expect(result.ok).toBe(true);

    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get("job_1") as { status: string };
    expect(job.status).toBe("accepted");
  });

  it("un al doilea accept pe același job eșuează cu 409", async () => {
    const firmIds = seedClientAndFirms(db, 2);
    seedWaitingJob(db, "job_1");

    await acceptJobAtomic(db, "job_1", firmIds[0]);
    const second = await acceptJobAtomic(db, "job_1", firmIds[1]);

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(409);
  });

  it("sub concurență reală (10 firme lovind simultan), exact una câștigă lucrarea", async () => {
    const N = 10;
    const firmIds = seedClientAndFirms(db, N);
    seedWaitingJob(db, "job_race");

    // Fiecare "cerere" e învelită într-un Promise (simulează N request-uri HTTP
    // paralele) — dar apelul sincron acceptJobAtomic() în sine nu are niciun
    // `await` între citire și scriere, exact cum ar rula într-un singur proces
    // Node.js care deservește N cereri concurente. Verificat și live cu curl
    // (3 procese paralele lovind serverul de dev) — vezi README.
    const results = await Promise.all(
      firmIds.map((firmId) => Promise.resolve().then(() => acceptJobAtomic(db, "job_race", firmId)))
    );

    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);

    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(N - 1);
    for (const l of losses) {
      if (!l.ok) expect(l.status).toBe(409);
    }

    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get("job_race") as {
      status: string;
      accepted_firm_id: string;
    };
    expect(job.status).toBe("accepted");
    expect(job.accepted_firm_id).not.toBeNull();

    // Autorizarea de plată s-a făcut o singură dată, pentru câștigător.
    const payments = db.prepare("SELECT * FROM payments WHERE job_id = ?").all("job_race");
    expect(payments).toHaveLength(1);
  });

  it("respinge acceptarea unei firme suspendate", async () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedWaitingJob(db, "job_1");
    db.prepare("UPDATE firms SET suspended_until = ? WHERE id = ?").run(
      new Date(Date.now() + 86_400_000).toISOString(),
      firmId
    );

    const result = await acceptJobAtomic(db, "job_1", firmId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("respinge o firmă neverificată sau din afara zonei lucrării", async () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedWaitingJob(db, "job_1");
    db.prepare("UPDATE firms SET verified = 0 WHERE id = ?").run(firmId);
    expect(await acceptJobAtomic(db, "job_1", firmId)).toMatchObject({ ok: false, status: 403 });

    db.prepare("UPDATE firms SET verified = 1, coverage_city = 'Brașov' WHERE id = ?").run(firmId);
    expect(await acceptJobAtomic(db, "job_1", firmId)).toMatchObject({ ok: false, status: 403 });
  });
});
