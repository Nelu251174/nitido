import { describe, it, expect, beforeEach } from "vitest";
import DatabaseCtor from "better-sqlite3";
import type { Database } from "better-sqlite3";
import { SCHEMA_SQL, newId } from "./db";
import {
  SCAN_ROOMS,
  normalizeScanRoom,
  scanRoomLabel,
  listScanPhotosForJob,
} from "./nitidoScan";

function makeTestDb(): Database {
  const db = new DatabaseCtor(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seedJobWithClient(db: Database): { jobId: string; clientId: string } {
  const clientId = newId("user");
  db.prepare("INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, 'Client Test', 'x', 'client')").run(clientId, `c${clientId}@test.ro`);
  const jobId = newId("job");
  db.prepare(
    `INSERT INTO jobs (id, client_id, street, city, sqm, space_type, when_type, scheduled_at, price_gross, duration_minutes, status)
     VALUES (?, ?, 'Str. Test 1', 'Constanța', 60, 'apartament', 'asap', datetime('now'), 400, 120, 'waiting')`
  ).run(jobId, clientId);
  return { jobId, clientId };
}

function addScanPhoto(db: Database, jobId: string, clientId: string, room: string | null): string {
  const id = newId("photo");
  db.prepare(
    `INSERT INTO job_photos (id, job_id, owner_user_id, proof_type, context_label, filename, status, validated_at)
     VALUES (?, ?, ?, 'CLIENT_CONTEXT', ?, ?, 'VALID', datetime('now'))`
  ).run(id, jobId, clientId, room, `${id}.jpg`);
  return id;
}

describe("nitidoScan — poze ghidate pe încăpere (Pachet C)", () => {
  it("normalizeScanRoom acceptă cheile valide și le normalizează la lowercase", () => {
    expect(normalizeScanRoom("bucatarie")).toBe("bucatarie");
    expect(normalizeScanRoom("  BAIE ")).toBe("baie");
    expect(normalizeScanRoom("living")).toBe("living");
  });

  it("normalizeScanRoom respinge valorile necunoscute sau greșite", () => {
    expect(normalizeScanRoom("garaj")).toBeNull();
    expect(normalizeScanRoom("")).toBeNull();
    expect(normalizeScanRoom(null)).toBeNull();
    expect(normalizeScanRoom(42)).toBeNull();
  });

  it("scanRoomLabel întoarce eticheta afișabilă, cu fallback pentru necunoscut", () => {
    expect(scanRoomLabel("bucatarie")).toBe("Bucătărie");
    expect(scanRoomLabel("baie")).toBe("Baie");
    expect(scanRoomLabel(null)).toBe("Alt spațiu");
    expect(scanRoomLabel("garaj")).toBe("Alt spațiu");
  });

  it("toate încăperile din SCAN_ROOMS au etichetă coerentă", () => {
    for (const r of SCAN_ROOMS) {
      expect(normalizeScanRoom(r.key)).toBe(r.key);
      expect(scanRoomLabel(r.key)).toBe(r.label);
    }
  });

  describe("listScanPhotosForJob", () => {
    let db: Database;
    beforeEach(() => {
      db = makeTestDb();
    });

    it("întoarce pozele de context etichetate, în ordinea încărcării", () => {
      const { jobId, clientId } = seedJobWithClient(db);
      addScanPhoto(db, jobId, clientId, "bucatarie");
      addScanPhoto(db, jobId, clientId, "baie");
      const photos = listScanPhotosForJob(db, jobId);
      expect(photos).toHaveLength(2);
      expect(photos[0].room).toBe("bucatarie");
      expect(photos[0].roomLabel).toBe("Bucătărie");
      expect(photos[0].url).toBe(`/api/uploads/${photos[0].id}`);
      expect(photos[1].roomLabel).toBe("Baie");
    });

    it("poză fără etichetă → roomLabel 'Alt spațiu'", () => {
      const { jobId, clientId } = seedJobWithClient(db);
      addScanPhoto(db, jobId, clientId, null);
      const [photo] = listScanPhotosForJob(db, jobId);
      expect(photo.room).toBeNull();
      expect(photo.roomLabel).toBe("Alt spațiu");
    });

    it("nu include pozele altei lucrări sau pe cele nevalide", () => {
      const { jobId, clientId } = seedJobWithClient(db);
      addScanPhoto(db, jobId, clientId, "living");
      // poză respinsă → exclusă
      const rejected = addScanPhoto(db, jobId, clientId, "hol");
      db.prepare("UPDATE job_photos SET status='REJECTED' WHERE id=?").run(rejected);
      // altă lucrare
      const other = seedJobWithClient(db);
      addScanPhoto(db, other.jobId, other.clientId, "dormitor");
      const photos = listScanPhotosForJob(db, jobId);
      expect(photos).toHaveLength(1);
      expect(photos[0].room).toBe("living");
    });
  });
});
