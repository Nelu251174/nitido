import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import { createOffer, listOffersForJob, selectOffer, withdrawOffer } from "./offers";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seedClientAndFirms(db: Database, n: number): string[] {
  db.prepare("INSERT INTO users (id, role, name) VALUES ('client_1','client','Test Client')").run();
  const firmIds: string[] = [];
  for (let i = 0; i < n; i++) {
    db.prepare("INSERT INTO users (id, role, name) VALUES (?, 'firma', ?)").run(`firm_user_${i}`, `Firma ${i}`);
    db.prepare("INSERT INTO firms (id, user_id, coverage_city, verified) VALUES (?, ?, 'Constanța', 1)").run(`firm_${i}`, `firm_user_${i}`);
    firmIds.push(`firm_${i}`);
  }
  return firmIds;
}

function seedStandardJob(db: Database, id: string): void {
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status, mode)
     VALUES (?, 'client_1', 'Str. Test 1', 'Constanța', 75, 'apartament', 'asap', 550, 150, 'waiting', 'standard')`
  ).run(id);
}

function seedExpressJob(db: Database, id: string): void {
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status, mode)
     VALUES (?, 'client_1', 'Str. Test 1', 'Constanța', 75, 'apartament', 'asap', 550, 150, 'waiting', 'express')`
  ).run(id);
}

describe("offers — selecția pe calitate (Etapa 2, mod 'standard')", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
  });

  it("o firmă verificată din zonă poate trimite o ofertă la o lucrare standard", () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedStandardJob(db, "job_1");
    const r = createOffer(db, "job_1", firmId, "Disponibili mâine dimineață");
    expect(r.ok).toBe(true);
    expect(listOffersForJob(db, "job_1")).toHaveLength(1);
  });

  it("aceeași firmă nu poate trimite două oferte la aceeași lucrare (409)", () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedStandardJob(db, "job_1");
    expect(createOffer(db, "job_1", firmId).ok).toBe(true);
    const second = createOffer(db, "job_1", firmId);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(409);
  });

  it("nu se pot trimite oferte la o lucrare Express (409)", () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedExpressJob(db, "job_x");
    const r = createOffer(db, "job_x", firmId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(409);
  });

  it("respinge firmă neverificată sau din afara zonei", () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedStandardJob(db, "job_1");
    db.prepare("UPDATE firms SET verified = 0 WHERE id = ?").run(firmId);
    expect(createOffer(db, "job_1", firmId)).toMatchObject({ ok: false, status: 403 });
    db.prepare("UPDATE firms SET verified = 1, coverage_city = 'Brașov' WHERE id = ?").run(firmId);
    expect(createOffer(db, "job_1", firmId)).toMatchObject({ ok: false, status: 403 });
  });

  it("clientul alege o ofertă → lucrarea devine acceptată pe firma aleasă + plata autorizată", async () => {
    const firmIds = seedClientAndFirms(db, 3);
    seedStandardJob(db, "job_1");
    const offerIds = firmIds.map((f) => {
      const r = createOffer(db, "job_1", f);
      return r.ok ? r.offerId : "";
    });

    const chosen = offerIds[1];
    const res = await selectOffer(db, "job_1", chosen, "client_1");
    expect(res.ok).toBe(true);

    const job = db.prepare("SELECT status, accepted_firm_id FROM jobs WHERE id='job_1'").get() as { status: string; accepted_firm_id: string };
    expect(job.status).toBe("accepted");
    expect(job.accepted_firm_id).toBe(firmIds[1]);

    // Oferta aleasă e 'accepted', restul 'rejected'.
    const chosenOffer = db.prepare("SELECT status FROM offers WHERE id=?").get(chosen) as { status: string };
    expect(chosenOffer.status).toBe("accepted");
    const rejected = db.prepare("SELECT COUNT(*) AS n FROM offers WHERE job_id='job_1' AND status='rejected'").get() as { n: number };
    expect(rejected.n).toBe(2);

    // Plata s-a autorizat o singură dată.
    const payments = db.prepare("SELECT * FROM payments WHERE job_id='job_1'").all();
    expect(payments).toHaveLength(1);
  });

  it("a doua selecție pe aceeași lucrare eșuează (deja preluată)", async () => {
    const firmIds = seedClientAndFirms(db, 2);
    seedStandardJob(db, "job_1");
    const o0 = createOffer(db, "job_1", firmIds[0]);
    const o1 = createOffer(db, "job_1", firmIds[1]);
    const id0 = o0.ok ? o0.offerId : "";
    const id1 = o1.ok ? o1.offerId : "";

    expect((await selectOffer(db, "job_1", id0, "client_1")).ok).toBe(true);
    const second = await selectOffer(db, "job_1", id1, "client_1");
    expect(second.ok).toBe(false);
  });

  it("un alt client nu poate selecta oferta la lucrarea altcuiva (403)", async () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedStandardJob(db, "job_1");
    const o = createOffer(db, "job_1", firmId);
    const id = o.ok ? o.offerId : "";
    db.prepare("INSERT INTO users (id, role, name) VALUES ('client_2','client','Altul')").run();
    const res = await selectOffer(db, "job_1", id, "client_2");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("o firmă își poate retrage oferta cât timp e în așteptare", () => {
    const [firmId] = seedClientAndFirms(db, 1);
    seedStandardJob(db, "job_1");
    const o = createOffer(db, "job_1", firmId);
    const id = o.ok ? o.offerId : "";
    expect(withdrawOffer(db, id, firmId).ok).toBe(true);
    expect(listOffersForJob(db, "job_1")).toHaveLength(0);
  });
});
