import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL, newId } from "./db";
import {
  EXPRESS_60_FEE_LEI,
  EXPRESS_60_WINDOW_MINUTES,
  express60Deadline,
  express60MinutesLeft,
  markExpress60Met,
  expireExpress60Guarantees,
} from "./express60";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seedClient(db: Database): string {
  const clientId = newId("user");
  db.prepare("INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, 'Client', 'x', 'client')").run(
    clientId,
    `c${clientId}@test.ro`
  );
  return clientId;
}

interface SeedOpts {
  express60?: boolean;
  fee?: number;
  status?: string;
  express60Status?: string | null;
  createdAt?: string;
  priceGross?: number;
}

function seedJob(db: Database, clientId: string, opts: SeedOpts = {}): string {
  const jobId = newId("job");
  const createdAt = opts.createdAt ?? new Date().toISOString();
  const deadline = opts.express60 ? express60Deadline(createdAt).toISOString() : null;
  db.prepare(
    `INSERT INTO jobs
      (id, client_id, street, city, sqm, space_type, when_type, scheduled_at, price_gross, duration_minutes,
       mode, express_60, express_60_fee, express_60_deadline, express_60_status, status, created_at)
     VALUES (?, ?, 'Str. 1', 'Constanța', 60, 'apartament', 'asap', ?, ?, 120, 'express', ?, ?, ?, ?, ?, ?)`
  ).run(
    jobId,
    clientId,
    createdAt,
    opts.priceGross ?? 479,
    opts.express60 ? 1 : 0,
    opts.fee ?? (opts.express60 ? EXPRESS_60_FEE_LEI : 0),
    deadline,
    opts.express60Status ?? (opts.express60 ? "pending" : null),
    opts.status ?? "waiting",
    createdAt
  );
  return jobId;
}

describe("express60 — tier premium cu preluare garantată (Pachet C)", () => {
  it("suplimentul și fereastra au valorile de business așteptate", () => {
    expect(EXPRESS_60_FEE_LEI).toBe(79);
    expect(EXPRESS_60_WINDOW_MINUTES).toBe(60);
  });

  it("express60Deadline = postare + fereastră", () => {
    const created = "2026-01-01T10:00:00.000Z";
    expect(express60Deadline(created).toISOString()).toBe("2026-01-01T11:00:00.000Z");
    expect(express60Deadline(created, 30).toISOString()).toBe("2026-01-01T10:30:00.000Z");
  });

  it("express60MinutesLeft nu coboară sub 0", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    expect(express60MinutesLeft("2026-01-01T10:45:00.000Z", now)).toBe(45);
    expect(express60MinutesLeft("2026-01-01T09:00:00.000Z", now)).toBe(0);
  });

  describe("markExpress60Met", () => {
    let db: Database;
    let clientId: string;
    beforeEach(() => {
      db = makeTestDb();
      clientId = seedClient(db);
    });

    it("marchează 'met' o lucrare Express 60 în așteptare", () => {
      const jobId = seedJob(db, clientId, { express60: true });
      markExpress60Met(db, jobId);
      const row = db.prepare("SELECT express_60_status FROM jobs WHERE id=?").get(jobId) as { express_60_status: string };
      expect(row.express_60_status).toBe("met");
    });

    it("nu atinge o lucrare care nu e Express 60", () => {
      const jobId = seedJob(db, clientId, { express60: false });
      markExpress60Met(db, jobId);
      const row = db.prepare("SELECT express_60_status FROM jobs WHERE id=?").get(jobId) as { express_60_status: string | null };
      expect(row.express_60_status).toBeNull();
    });

    it("nu suprascrie o garanție deja 'breached'", () => {
      const jobId = seedJob(db, clientId, { express60: true, express60Status: "breached" });
      markExpress60Met(db, jobId);
      const row = db.prepare("SELECT express_60_status FROM jobs WHERE id=?").get(jobId) as { express_60_status: string };
      expect(row.express_60_status).toBe("breached");
    });
  });

  describe("expireExpress60Guarantees", () => {
    let db: Database;
    let clientId: string;
    beforeEach(() => {
      db = makeTestDb();
      clientId = seedClient(db);
    });

    it("retrogradează lucrarea expirată: scoate suplimentul + marchează 'breached'", () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // acum 2h
      const jobId = seedJob(db, clientId, { express60: true, createdAt: past, priceGross: 479, fee: 79 });
      const { breached } = expireExpress60Guarantees(db, new Date());
      expect(breached).toContain(jobId);
      const row = db.prepare("SELECT express_60, express_60_status, price_gross, status FROM jobs WHERE id=?").get(jobId) as {
        express_60: number;
        express_60_status: string;
        price_gross: number;
        status: string;
      };
      expect(row.express_60).toBe(0);
      expect(row.express_60_status).toBe("breached");
      expect(row.price_gross).toBe(400); // 479 - 79
      expect(row.status).toBe("waiting"); // rămâne activă ca express standard
    });

    it("nu atinge o lucrare încă în fereastra de 60 min", () => {
      const jobId = seedJob(db, clientId, { express60: true, priceGross: 479, fee: 79 });
      const { breached } = expireExpress60Guarantees(db, new Date());
      expect(breached).toHaveLength(0);
      const row = db.prepare("SELECT express_60, price_gross FROM jobs WHERE id=?").get(jobId) as { express_60: number; price_gross: number };
      expect(row.express_60).toBe(1);
      expect(row.price_gross).toBe(479);
    });

    it("nu atinge o lucrare deja preluată (met), chiar dacă termenul a trecut", () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const jobId = seedJob(db, clientId, { express60: true, createdAt: past, status: "accepted", express60Status: "met" });
      const { breached } = expireExpress60Guarantees(db, new Date());
      expect(breached).toHaveLength(0);
      const row = db.prepare("SELECT express_60_status FROM jobs WHERE id=?").get(jobId) as { express_60_status: string };
      expect(row.express_60_status).toBe("met");
    });

    it("este idempotentă — a doua trecere nu mai schimbă nimic", () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      seedJob(db, clientId, { express60: true, createdAt: past, priceGross: 479, fee: 79 });
      const first = expireExpress60Guarantees(db, new Date());
      const second = expireExpress60Guarantees(db, new Date());
      expect(first.breached).toHaveLength(1);
      expect(second.breached).toHaveLength(0);
    });
  });
});
