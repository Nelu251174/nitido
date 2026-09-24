import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase, SCHEMA_SQL } from './db';

function legacyDatabase() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  // Snapshot support predates the occurrence-generation migration.
  db.exec("ALTER TABLE jobs ADD COLUMN pricing_snapshot TEXT");
  db.exec(`INSERT INTO users(id,role,name) VALUES('client','client','Client');
    INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,pricing_snapshot)
      VALUES('job','client','Test','București',50,'apartament','scheduled',450,120,'waiting','historical-price');
    INSERT INTO recurring_plans(id,client_id,frequency,street,city,sqm,space_type,hour,next_run_date)
      VALUES('plan','client','monthly','Test','București',50,'apartament',10,'2026-01-31');
    INSERT INTO recurring_occurrences(plan_id,occurrence_date,job_id,scheduled_at)
      VALUES('plan','2026-01-31','job','2026-01-31T08:00:00.000Z');`);
  return db;
}

describe('shared database initialization', () => {
  it('upgrades the legacy occurrence key without losing visits or published prices', () => {
    const db = legacyDatabase();
    try {
      initializeDatabase(db);
      expect(db.prepare('SELECT plan_id,schedule_generation,occurrence_date,job_id FROM recurring_occurrences').all())
        .toEqual([{plan_id:'plan',schedule_generation:0,occurrence_date:'2026-01-31',job_id:'job'}]);
      expect(db.prepare('SELECT anchor_day,schedule_generation FROM recurring_plans').get()).toEqual({anchor_day:31,schedule_generation:0});
      expect(db.prepare('SELECT pricing_snapshot,price_gross FROM jobs').get()).toEqual({pricing_snapshot:'historical-price',price_gross:450});
      expect(() => db.exec("UPDATE jobs SET pricing_snapshot='changed'")).toThrow(/immutable/);
      expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
  });

  it('can run repeatedly while preserving user data and stable schema', () => {
    const db = legacyDatabase();
    try {
      initializeDatabase(db);
      const schema = () => db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
      const before = schema();
      initializeDatabase(db);
      expect(schema()).toEqual(before);
      expect(db.prepare('SELECT COUNT(*) n FROM users').get()).toEqual({n:1});
      expect(db.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:1});
      expect(db.prepare('SELECT COUNT(*) n FROM recurring_occurrences').get()).toEqual({n:1});
      expect(db.prepare('SELECT COUNT(*) n FROM estimator_options').get()).toEqual({n:4});
      expect(db.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);
    } finally { db.close(); }
  });
});
