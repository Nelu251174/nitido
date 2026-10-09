import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL } from "./db";
import {
  ESTIMATOR_OPTIONS,
  getEstimatorOptions,
  getActiveEstimatorOptions,
  updateEstimatorOption,
} from "./estimatorConfig";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seed(db: Database): void {
  const ins = db.prepare("INSERT INTO estimator_options (key, label, enabled, sort_order) VALUES (?, ?, ?, ?)");
  [["apartament", "Apartament", 1], ["casa", "Casă / Vilă", 1], ["birou", "Birou", 1], ["altul", "Altul", 1]].forEach(([k, l, e], i) => ins.run(k, l, e, i));
}

describe("estimatorConfig — ESTIMATOR LIVE gestionat de admin", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
  });

  it("fără date în DB → folosește opțiunile implicite (fallback)", () => {
    expect(getEstimatorOptions(db)).toEqual(ESTIMATOR_OPTIONS);
  });

  it("citește opțiunile din DB după seed", () => {
    seed(db);
    const opts = getEstimatorOptions(db);
    expect(opts).toHaveLength(4);
    expect(opts[0]).toEqual({ key: "apartament", label: "Apartament", enabled: true });
  });

  it("adminul redenumește un tip", () => {
    seed(db);
    expect(updateEstimatorOption(db, "casa", { label: "Vilă" })).toBe(true);
    expect(getEstimatorOptions(db).find((o) => o.key === "casa")?.label).toBe("Vilă");
  });

  it("adminul ascunde un tip → nu mai apare în cele active", () => {
    seed(db);
    updateEstimatorOption(db, "altul", { enabled: false });
    const active = getActiveEstimatorOptions(db);
    expect(active.some((o) => o.key === "altul")).toBe(false);
    expect(active).toHaveLength(3);
  });

  it("update pe un tip inexistent întoarce false", () => {
    seed(db);
    // @ts-expect-error test cu cheie invalidă
    expect(updateEstimatorOption(db, "castel", { label: "X" })).toBe(false);
  });
});
