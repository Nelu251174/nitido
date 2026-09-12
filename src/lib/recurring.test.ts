import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import {
  createRecurringPlan,
  computeNextDate,
  bucharestScheduledAt,
  generateDueRecurringJobs,
  listPlansForClient,
  listRecurringOccurrences,
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

    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-05T06:00:00Z"));
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
    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-05T06:00:00Z"));
    expect(created).toHaveLength(0);
  });

  it("generarea filtrată pe client afectează doar planurile clientului dat", async () => {
    seedClientAndFirm(db);
    db.prepare("INSERT INTO users (id, role, name) VALUES ('client_2','client','Alt Client')").run();
    createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-01-05" });
    createRecurringPlan(db, { ...basePlan, clientId: "client_2", preferredFirmId: "firm_pref", startDate: "2026-01-05" });

    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-05T06:00:00Z"), "client_1");
    expect(created).toHaveLength(1);
    const c2jobs = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE client_id='client_2'").get() as { n: number };
    expect(c2jobs.n).toBe(0);
  });

  it("un plan pe pauză nu generează lucrări", async () => {
    seedClientAndFirm(db);
    const r = createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-01-05" });
    const planId = r.ok ? r.planId : "";
    expect(setPlanStatus(db, planId, "client_1", "paused").ok).toBe(true);
    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-05T06:00:00Z"));
    expect(created).toHaveLength(0);
  });

  it("dacă firma preferată nu acoperă zona, lucrarea rămâne waiting (nu blochează abonamentul)", async () => {
    seedClientAndFirm(db);
    db.prepare("UPDATE firms SET coverage_city='Brașov' WHERE id='firm_pref'").run();
    createRecurringPlan(db, { ...basePlan, preferredFirmId: "firm_pref", startDate: "2026-01-05" });
    const { created } = await generateDueRecurringJobs(db, new Date("2026-01-05T06:00:00Z"));
    expect(created).toHaveLength(1);
    const job = db.prepare("SELECT status FROM jobs WHERE id = ?").get(created[0]) as { status: string };
    expect(job.status).toBe("waiting");
  });
  it("clamps a monthly occurrence and restores its anchor day",()=>{
    expect(computeNextDate("monthly",new Date("2026-01-31T12:00:00Z"),31)).toBe("2026-02-28");
    expect(computeNextDate("monthly",new Date("2026-02-28T12:00:00Z"),31)).toBe("2026-03-31");
  });
  it("keeps local booking time across daylight saving changes",()=>{
    expect(bucharestScheduledAt("2026-03-28",10).toISOString()).toBe("2026-03-28T08:00:00.000Z");
    expect(bucharestScheduledAt("2026-03-29",10).toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });
  it("skips missed occurrences instead of creating past bookings",async()=>{
    seedClientAndFirm(db);createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});
    expect((await generateDueRecurringJobs(db,new Date("2026-01-06T09:00:00Z"))).created).toHaveLength(0);
    expect((db.prepare("SELECT next_run_date FROM recurring_plans").get() as {next_run_date:string}).next_run_date).toBe("2026-01-12");
  });
  it("does not create duplicates when schedulers run concurrently",async()=>{
    const firmId=seedClientAndFirm(db);createRecurringPlan(db,{...basePlan,preferredFirmId:firmId,startDate:"2026-01-05"});
    const results=await Promise.all([generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z")),generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"))]);
    expect(results.flatMap(r=>r.created)).toHaveLength(1);
  });

  it("cancelled plans remain terminal and cancellation is repeatable",async()=>{
    seedClientAndFirm(db);
    const created=createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});
    if(!created.ok)throw new Error("fixture");
    expect(setPlanStatus(db,created.planId,"client_1","cancelled").ok).toBe(true);
    expect(setPlanStatus(db,created.planId,"client_1","active")).toMatchObject({ok:false,status:409});
    expect(setPlanStatus(db,created.planId,"client_1","paused")).toMatchObject({ok:false,status:409});
    expect(setPlanStatus(db,created.planId,"client_1","cancelled").ok).toBe(true);
    expect((await generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"))).created).toEqual([]);
  });
  it("another client cannot pause a plan and invalid state leaves it unchanged",()=>{
    seedClientAndFirm(db);const created=createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});
    if(!created.ok)throw new Error("fixture");
    expect(setPlanStatus(db,created.planId,"other","paused")).toMatchObject({ok:false,status:404});
    expect(setPlanStatus(db,created.planId,"client_1","invalid" as never)).toMatchObject({ok:false,status:400});
    expect(db.prepare("SELECT status FROM recurring_plans WHERE id=?").get(created.planId)).toEqual({status:"active"});
  });
  it("pausing a series preserves its already generated visit",async()=>{
    seedClientAndFirm(db);const created=createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});
    if(!created.ok)throw new Error("fixture");
    const jobs=await generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"));
    const before=db.prepare("SELECT * FROM jobs WHERE id=?").get(jobs.created[0]);
    expect(setPlanStatus(db,created.planId,"client_1","paused").ok).toBe(true);
    expect(db.prepare("SELECT * FROM jobs WHERE id=?").get(jobs.created[0])).toEqual(before);
    expect((await generateDueRecurringJobs(db,new Date("2026-01-12T06:00:00Z"))).created).toEqual([]);
    expect(setPlanStatus(db,created.planId,"client_1","active").ok).toBe(true);
  });

  it("rejects oversized recurring requests without creating a plan",()=>{
    seedClientAndFirm(db);
    expect(createRecurringPlan(db,{...basePlan,sqm:1001,startDate:"2026-01-05"})).toMatchObject({ok:false,status:422});
    expect(listPlansForClient(db,"client_1")).toEqual([]);
    expect(createRecurringPlan(db,{...basePlan,sqm:1000,startDate:"2026-01-05"}).ok).toBe(true);
  });
  it("rejects malformed text and quantities instead of coercing or truncating them",()=>{
    seedClientAndFirm(db);
    for(const fields of [{city:{}},{street:" "},{details:"x".repeat(501)},{floor:[]},{sqm:"75"},{hour:"10"},{startDate:{}},{startDate:"2026-02-30"}]){
      expect(createRecurringPlan(db,{...basePlan,startDate:"2026-01-05",...fields} as never).ok).toBe(false);
    }
    expect(listPlansForClient(db,"client_1")).toEqual([]);
  });
  it("stores the monthly anchor with the initial insert",()=>{
    seedClientAndFirm(db);
    db.exec("CREATE TRIGGER reject_anchor_update BEFORE UPDATE OF anchor_day ON recurring_plans BEGIN SELECT RAISE(ABORT,'no follow-up update'); END");
    const result=createRecurringPlan(db,{...basePlan,frequency:"monthly",startDate:"2026-01-31"});
    expect(result.ok).toBe(true);
    expect(db.prepare("SELECT anchor_day FROM recurring_plans").get()).toEqual({anchor_day:31});
  });

  it("records each occurrence and protects against resetting the series cursor",async()=>{
    seedClientAndFirm(db);const plan=createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});if(!plan.ok)throw new Error("fixture");
    const first=await generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"));
    db.prepare("UPDATE recurring_plans SET next_run_date='2026-01-05' WHERE id=?").run(plan.planId);
    expect((await generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"))).created).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) n FROM jobs").get()).toEqual({n:1});
    expect(listRecurringOccurrences(db,"client_1")).toMatchObject([{plan_id:plan.planId,job_id:first.created[0],occurrence_date:"2026-01-05",scheduled_at:"2026-01-05T08:00:00.000Z"}]);
  });
  it("rolls back job creation and cursor when occurrence persistence fails",async()=>{
    seedClientAndFirm(db);createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});
    db.exec("CREATE TRIGGER fail_occurrence BEFORE INSERT ON recurring_occurrences BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END");
    await expect(generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"))).rejects.toThrow(/simulated/);
    expect(db.prepare("SELECT COUNT(*) n FROM jobs").get()).toEqual({n:0});
    expect(db.prepare("SELECT next_run_date,last_job_id FROM recurring_plans").get()).toEqual({next_run_date:"2026-01-05",last_job_id:null});
  });
  it("retains cancelled series history and isolates owners",async()=>{
    seedClientAndFirm(db);const plan=createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});if(!plan.ok)throw new Error("fixture");
    await generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"));
    setPlanStatus(db,plan.planId,"client_1","cancelled");
    expect(listRecurringOccurrences(db,"client_1")).toHaveLength(1);
    expect(listRecurringOccurrences(db,"other")).toEqual([]);
  });
  it("does not infer an occurrence from a legacy last-job pointer",async()=>{
    seedClientAndFirm(db);createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});
    await generateDueRecurringJobs(db,new Date("2026-01-05T06:00:00Z"));
    db.exec("DELETE FROM recurring_occurrences");
    expect(listRecurringOccurrences(db,"client_1")).toEqual([]);
  });

  it.each([
    ["weekly", "2026-01-05", "2026-01-12T06:00:00Z", "2026-01-12", "2026-01-12T08:00:00.000Z"],
    ["biweekly", "2026-01-05", "2026-01-19T06:00:00Z", "2026-01-19", "2026-01-19T08:00:00.000Z"],
    ["monthly", "2026-01-31", "2026-03-31T06:00:00Z", "2026-03-31", "2026-03-31T07:00:00.000Z"],
    ["weekly", "2026-03-22", "2026-03-29T06:00:00Z", "2026-03-29", "2026-03-29T07:00:00.000Z"],
  ])("resumes %s without discarding today's upcoming visit",async(frequency,startDate,now,date,scheduled)=>{
    seedClientAndFirm(db);
    const plan=createRecurringPlan(db,{...basePlan,frequency:frequency as "weekly"|"biweekly"|"monthly",startDate});
    if(!plan.ok)throw new Error("fixture");
    setPlanStatus(db,plan.planId,"client_1","paused");
    expect((await generateDueRecurringJobs(db,new Date(now))).created).toEqual([]);
    setPlanStatus(db,plan.planId,"client_1","active");
    const result=await generateDueRecurringJobs(db,new Date(now));
    expect(result.created).toHaveLength(1);
    expect(listRecurringOccurrences(db,"client_1")).toMatchObject([{occurrence_date:date,scheduled_at:scheduled}]);
    expect((await generateDueRecurringJobs(db,new Date(now))).created).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) n FROM jobs").get()).toEqual({n:1});
  });
  it("skips today's elapsed visit after an interruption",async()=>{
    seedClientAndFirm(db);createRecurringPlan(db,{...basePlan,startDate:"2026-01-05"});
    expect((await generateDueRecurringJobs(db,new Date("2026-01-12T08:00:01Z"))).created).toEqual([]);
    expect(db.prepare("SELECT next_run_date FROM recurring_plans").get()).toEqual({next_run_date:"2026-01-19"});
    expect(listRecurringOccurrences(db,"client_1")).toEqual([]);
  });

});
