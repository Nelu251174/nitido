import { describe, it, expect } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import { computeQualityScore, getFirmQuality } from "./qualityIndex";

describe("qualityIndex — Nitido Quality Index", () => {
  it("firmă perfectă (5★, 50+ lucrări, 0 strikes) → 100", () => {
    expect(computeQualityScore({ avgStars: 5, ratingCount: 40, completedJobs: 60, strikes90d: 0, verified: true }).score).toBe(100);
  });

  it("firmă nouă (fără rating, fără lucrări, fără strikes) → 20 (doar fiabilitate)", () => {
    const q = computeQualityScore({ avgStars: null, ratingCount: 0, completedJobs: 0, strikes90d: 0, verified: true });
    expect(q.rating).toBe(0);
    expect(q.experience).toBe(0);
    expect(q.reliability).toBe(20);
    expect(q.score).toBe(20);
  });

  it("strikes reduc fiabilitatea", () => {
    expect(computeQualityScore({ avgStars: 5, ratingCount: 10, completedJobs: 50, strikes90d: 2, verified: true }).reliability).toBe(10);
    expect(computeQualityScore({ avgStars: 5, ratingCount: 10, completedJobs: 50, strikes90d: 5, verified: true }).reliability).toBe(0);
  });

  it("rating parțial e proporțional", () => {
    // 4 stele → 4/5*60 = 48
    expect(computeQualityScore({ avgStars: 4, ratingCount: 10, completedJobs: 0, strikes90d: 0, verified: true }).rating).toBe(48);
  });

  it("getFirmQuality citește datele reale ale firmei", () => {
    const db: Database = new DatabaseCtor(":memory:");
    db.exec(SCHEMA_SQL);
    db.prepare("INSERT INTO users (id, role, name) VALUES ('c','client','C')").run();
    db.prepare("INSERT INTO users (id, role, name) VALUES ('fu','firma','F')").run();
    db.prepare("INSERT INTO firms (id, user_id, coverage_city, verified, strikes_90d) VALUES ('firm_1','fu','Constanța',1,0)").run();
    // 2 lucrări finalizate + 2 rating-uri de 5
    for (const id of ["j1", "j2"]) {
      db.prepare("INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, price_gross, duration_minutes, status, accepted_firm_id) VALUES (?, 'c','S','Constanța',75,'apartament','asap',550,150,'completed','firm_1')").run(id);
      db.prepare("INSERT INTO ratings (id, job_id, client_id, firm_id, stars, status) VALUES (?, ?, 'c','firm_1',5,'active')").run(`r_${id}`, id);
    }
    const q = getFirmQuality(db, "firm_1");
    expect(q.avgStars).toBe(5);
    expect(q.ratingCount).toBe(2);
    expect(q.completedJobs).toBe(2);
    expect(q.rating).toBe(60);
    expect(q.reliability).toBe(20);
    expect(q.score).toBeGreaterThanOrEqual(80);
  });
});
