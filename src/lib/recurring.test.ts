import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import {
  createRecurringPlan,
  computeNextDate,
  generateDueRecurringJobs,
  listPlansForClient,
  setPlanStatus,
} from "./recurring";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seedClientAndFirm(db: Database): string {
  db.prepare("INSERT INTO users (id, role, name) VALUES ('client_1','client','Test Client')").run();
  db.prepare("INSERT INTO users (id, role, name) VALUES ('firm_user','firma','Firma Pref')").run();
  db.prepare("INSERT INTO firms (id, user_id, coverage_city, verified) VALUES ('firm_pref','firm_user','Constanța',1)").run();
  return "firm_pref";
}

const basePlan = {
  clientId: "client_1",
  frequency: "weekly" as const,
  street: "Str. Test 1",
  city: "Constanța",
  sqm: 75,
  spaceType: "apartament" as const,
  hour: 10,
};

describe("recurring — Nitido Repeat (Etapa 3)", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
  });

  it("computeNextDate adaugă corect intervalul", () => {
    expect(computeNextDate("weekly", new Date("2026-01-01T00:00:00"))).toBe("2026-01-08");
    expect(computeNextDate("biweekly", new Date("2026-01-01T00:00:00"))).toBe("2026-01-15");
    expect(computeNextDate("monthly", new Date("2026-01-15T00:00:00"))).toBe("2026-02-15");
  });

  it("creează un plan și îl listează pentru client", () => {
    seedClientAndFirm(db);
    const r = createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-01-05" });
    expect(r.ok).toBe(true);
    expect(listPlansForClient(db, "client_1")).toHaveLength(1);
  });

  it("respinge input invalid (frecvență sau suprafață)", () => {
    seedClientAndFirm(db);
    expect(createRecurringPlan(db, { ...basePlan, sqm: 0, startDate: "2026-01-05" }).ok).toBe(false);
    expect(createRecurringPlan(db, { ...basePlan, frequency: "yearly" as never, startDate: "2026-01-05" }).ok).toBe(false);
  });

  it("generează lucrarea scadentă, o alocă firmei preferate și avansează next_run_date", async () => {
    const firmId = seedClientAndFirm(db);
    createRecurringPlan(db, { ...basePlan, preferredFirmId: firmId, startDate: "2026-01-05" });

    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-06T09:00:00"));
    expect(created).toHaveLength(1);

    const job = db.prepare("SELECT status, accepted_firm_id, mode FROM jobs WHERE id = ?").get(created[0]) as { status: string; accepted_firm_id: string; mode: string };
    expect(job.mode).toBe("express");
    expect(job.status).toBe("accepted");
    expect(job.accepted_firm_id).toBe(firmId);

    const plan = db.prepare("SELECT next_run_date, last_job_id FROM recurring_plans WHERE client_id='client_1'").get() as { next_run_date: string; last_job_id: string };
    expect(plan.next_run_date).toBe("2026-01-12"); // +7 zile
    expect(plan.last_job_id).toBe(created[0]);
  });

  it("nu generează nimic dacă nu e scadent încă", async () => {
    seedClientAndFirm(db);
    createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-02-01" });
    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-06T09:00:00"));
    expect(created).toHaveLength(0);
  });

  it("generarea filtrată pe client afectează doar planurile clientului dat", async () => {
    seedClientAndFirm(db);
    db.prepare("INSERT INTO users (id, role, name) VALUES ('client_2','client','Alt Client')").run();
    createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-01-05" });
    createRecurringPlan(db, { ...basePlan, clientId: "client_2", preferredFirmId: "firm_pref", startDate: "2026-01-05" });

    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-06T09:00:00"), "client_1");
    expect(created).toHaveLength(1);
    const c2jobs = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE client_id='client_2'").get() as { n: number };
    expect(c2jobs.n).toBe(0);
  });

  it("un plan pe pauză nu generează lucrări", async () => {
    seedClientAndFirm(db);
    const r = createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-01-05" });
    const planId = r.ok ? r.planId : "";
    expect(setPlanStatus(db, planId, "client_1", "paused").ok).toBe(true);
    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-06T09:00:00"));
    expect(created).toHaveLength(0);
  });

  it("dacă firma preferată nu acoperă zona, lucrarea rămâne waiting (nu blochează abonamentul)", async () => {
    seedClientAndFirm(db);
    db.prepare("UPDATE firms SET coverage_city='Brașov' WHERE id='firm_pref'").run();
    createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-01-05" });
    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-06T09:00:00"));
    expect(created).toHaveLength(1);
    const job = db.prepare("SELECT status FROM jobs WHERE id = ?").get(created[0]) as { status: string };
    expect(job.status).toBe("waiting");
  });
});
