import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sqlite from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCHEMA_SQL } from './db';
const provider = vi.hoisted(() => ({ authorize: vi.fn(), transfers: vi.fn(() => false) }));
vi.mock('@/lib/payments', () => ({ authorizePayment: provider.authorize, connectTransfersEnabled: provider.transfers }));
import { acceptJobAtomic } from './acceptJob';
import { createOffer, selectOffer, withdrawOffer } from './offers';

let db: Sqlite.Database;
let other: Sqlite.Database;
let directory: string;
beforeEach(() => {
  vi.resetAllMocks();
  provider.transfers.mockReturnValue(false);
  provider.authorize.mockResolvedValue('payment');
  directory = mkdtempSync(join(tmpdir(), 'nitido-allocation-'));
  db = new Sqlite(join(directory, 'test.sqlite'), { timeout: 0 });
  db.pragma('journal_mode=WAL');
  db.exec(SCHEMA_SQL);
  other = new Sqlite(join(directory, 'test.sqlite'), { timeout: 0 });
  db.exec(`INSERT INTO users(id,role,name) VALUES('c','client','Client'),('u','firma','Firm'),('v','firma','Other');
    INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('f','u','București',1),('g','v','București',1);`);
  job('a'); job('b');
});
afterEach(() => { vi.restoreAllMocks(); other.close(); db.close(); rmSync(directory, { recursive: true, force: true }); });
function job(id: string, start = '2030-09-13T08:00:00Z', duration = 60, buffer = 30) {
  db.prepare(`INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,buffer_minutes,status,mode)
    VALUES(?,'c','Test','București',75,'apartament','scheduled',?,550,?,?,'waiting','standard')`).run(id, start, duration, buffer);
}
function occupy(id = 'a', firm = 'f', status = 'accepted') {
  db.prepare('UPDATE jobs SET status=?,accepted_firm_id=? WHERE id=?').run(status, firm, id);
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  provider.authorize.mockImplementationOnce(() => new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
  return { resolve: () => resolve(), reject: () => reject(Error('private-provider-error')) };
}
function offer(id: string, firm = 'f') {
  const result = createOffer(db, id, firm);
  if (!result.ok) throw Error(result.error);
  return result.offerId;
}
const state = (id: string) => db.prepare('SELECT status,accepted_firm_id FROM jobs WHERE id=?').get(id);
const offers = () => db.prepare('SELECT id,status FROM offers ORDER BY id').all();

describe('allocation uses persisted timing and serializes firm-wide capacity', () => {
  it('a second SQLite connection cannot reserve an overlapping job while authorization is pending', async () => {
    const pending = deferred();
    const first = acceptJobAtomic(db, 'a', 'f');
    expect(await acceptJobAtomic(other, 'b', 'f')).toMatchObject({ ok: false, status: 409, code: 'CAPACITY_UNAVAILABLE' });
    expect(provider.authorize).toHaveBeenCalledTimes(1);
    expect(state('b')).toEqual({ status: 'waiting', accepted_firm_id: null });
    pending.resolve(); expect(await first).toEqual({ ok: true });
  });
  it('blocks a competing writer exactly after the availability snapshot, before reservation', async () => {
    const original = db.prepare.bind(db);
    let contenderCode: string | undefined;
    let attempted = false;
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const statement = original(sql);
      if (sql.includes('accepted_firm_id') && sql.includes("status IN ('accepted','arrived')")) {
        const all = statement.all.bind(statement);
        vi.spyOn(statement, 'all').mockImplementation((...args: unknown[]) => {
          const snapshot = all(...args);
          attempted = true;
          try { other.prepare("UPDATE jobs SET status='accepted',accepted_firm_id='f' WHERE id='b'").run(); }
          catch (error) { contenderCode = (error as { code: string }).code; }
          return snapshot;
        });
      }
      return statement;
    });
    expect(await acceptJobAtomic(db, 'a', 'f')).toEqual({ ok: true });
    expect(attempted).toBe(true);
    expect(contenderCode).toBe('SQLITE_BUSY');
    expect(state('b')).toEqual({ status: 'waiting', accepted_firm_id: null });
  });
  it('releases the database writer lock before calling the provider', async () => {
    provider.authorize.mockImplementation(async () => {
      expect(db.inTransaction).toBe(false);
      other.prepare("UPDATE users SET name='Still writable' WHERE id='v'").run();
    });
    expect(await acceptJobAtomic(db, 'a', 'f')).toEqual({ ok: true });
  });
  it('returns a controlled retry when another connection owns the writer lock', async () => {
    other.exec('BEGIN IMMEDIATE');
    try {
      expect(await acceptJobAtomic(db, 'a', 'f')).toMatchObject({ ok: false, status: 503 });
      expect(provider.authorize).not.toHaveBeenCalled();
      expect(state('a')).toEqual({ status: 'waiting', accepted_firm_id: null });
    } finally { other.exec('ROLLBACK'); }
    expect(await acceptJobAtomic(db, 'a', 'f')).toEqual({ ok: true });
  });
  it('refuses an outer transaction instead of carrying it across the provider await', async () => {
    db.exec('BEGIN IMMEDIATE');
    try { expect(await acceptJobAtomic(db, 'a', 'f')).toMatchObject({ ok: false, status: 409 }); }
    finally { db.exec('ROLLBACK'); }
    expect(provider.authorize).not.toHaveBeenCalled();
  });
  it('uses stored duration and travel buffer instead of recalculating from square metres', async () => {
    occupy();
    db.exec("UPDATE jobs SET duration_minutes=300,buffer_minutes=60 WHERE id='a'; UPDATE jobs SET scheduled_at='2030-09-13T13:30:00Z' WHERE id='b'");
    expect(await acceptJobAtomic(db, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
    expect(provider.authorize).not.toHaveBeenCalled();
  });
  it('allows adjacent intervals at the end of the saved travel buffer', async () => {
    occupy(); db.exec("UPDATE jobs SET scheduled_at='2030-09-13T09:30:00Z' WHERE id='b'");
    expect(await acceptJobAtomic(db, 'b', 'f')).toEqual({ ok: true });
  });
  it('checks the candidate duration and buffer in the reverse overlap direction', async () => {
    occupy(); db.exec("UPDATE jobs SET scheduled_at='2030-09-13T07:00:00Z',duration_minutes=45,buffer_minutes=30 WHERE id='b'");
    expect(await acceptJobAtomic(db, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
  });
  it.each(['completed', 'cancelled', 'no_show'])('does not reserve capacity for a %s job', async status => {
    occupy('a', 'f', status); expect(await acceptJobAtomic(db, 'b', 'f')).toEqual({ ok: true });
  });
  it('reserves arrived work and keeps different firms independent', async () => {
    occupy('a', 'f', 'arrived');
    expect(await acceptJobAtomic(db, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
    expect(await acceptJobAtomic(db, 'b', 'g')).toEqual({ ok: true });
  });
  it.each(["scheduled_at='broken'", 'scheduled_at=NULL', 'duration_minutes=0', 'duration_minutes=-1', 'duration_minutes=1.5', 'buffer_minutes=-1', 'buffer_minutes=1.5'])('refuses malformed candidate timing: %s', async assignment => {
    db.exec(`UPDATE jobs SET ${assignment} WHERE id='a'`);
    expect(await acceptJobAtomic(db, 'a', 'f')).toMatchObject({ ok: false, status: 409 });
    expect(provider.authorize).not.toHaveBeenCalled();
  });
  it('does not treat corrupt or unknown existing timing as free capacity', async () => {
    occupy(); db.exec("UPDATE jobs SET scheduled_at=NULL WHERE id='a'");
    expect(await acceptJobAtomic(db, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
  });
  it('preserves the first legacy ASAP job but blocks another overlapping or unknown booking', async () => {
    db.exec("UPDATE jobs SET scheduled_at=NULL,when_type='asap' WHERE id='a'");
    expect(await acceptJobAtomic(db, 'a', 'f')).toEqual({ ok: true });
    expect(await acceptJobAtomic(other, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
  });
  it('an unknown ASAP candidate cannot bypass existing scheduled work', async () => {
    occupy(); db.exec("UPDATE jobs SET scheduled_at=NULL,when_type='asap' WHERE id='b'");
    expect(await acceptJobAtomic(db, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
  });
  it('rolls back reservation if saving the claim fails, without calling the provider', async () => {
    db.exec("CREATE TRIGGER fail_claim BEFORE INSERT ON job_acceptance_claims BEGIN SELECT RAISE(ABORT,'private-db-error'); END");
    const result = await acceptJobAtomic(db, 'a', 'f');
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(JSON.stringify(result)).not.toContain('private-db-error');
    expect(state('a')).toEqual({ status: 'waiting', accepted_firm_id: null });
    expect(provider.authorize).not.toHaveBeenCalled();
  });
  it('does not authorize if the conditional reservation changed no row', async () => {
    db.exec("CREATE TRIGGER ignore_claim BEFORE UPDATE ON jobs WHEN NEW.status='accepted' BEGIN SELECT RAISE(IGNORE); END");
    expect(await acceptJobAtomic(db, 'a', 'f')).toMatchObject({ ok: false, status: 409 });
    expect(db.prepare('SELECT * FROM job_acceptance_claims').all()).toEqual([]);
    expect(provider.authorize).not.toHaveBeenCalled();
  });
  it('a locked compensation keeps capacity occupied and reports the unconfirmed release', async () => {
    const pending = deferred(); const first = acceptJobAtomic(db, 'a', 'f');
    other.exec('BEGIN IMMEDIATE');
    try {
      pending.reject(); expect(await first).toMatchObject({ ok: false, status: 503 });
      expect(state('a')).toEqual({ status: 'accepted', accepted_firm_id: 'f' });
    } finally { other.exec('ROLLBACK'); }
    expect(await acceptJobAtomic(db, 'b', 'f')).toMatchObject({ ok: false, code: 'CAPACITY_UNAVAILABLE' });
  });
  it('distinguishes another firm taking the job from a capacity or cancellation conflict', async () => {
    occupy('a', 'g');
    expect(await acceptJobAtomic(db, 'a', 'f')).toMatchObject({ ok: false, code: 'ALREADY_TAKEN' });
    db.exec("UPDATE jobs SET status='cancelled' WHERE id='a'");
    expect(await acceptJobAtomic(db, 'a', 'f')).toMatchObject({ ok: false, code: 'JOB_UNAVAILABLE' });
  });
  it('releases only failed authorization capacity and allows a waiting overlapping job', async () => {
    const pending = deferred(); const first = acceptJobAtomic(db, 'a', 'f');
    expect(await acceptJobAtomic(other, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
    pending.reject(); expect(await first).toMatchObject({ ok: false, status: 502 });
    expect(await acceptJobAtomic(other, 'b', 'f')).toEqual({ ok: true });
  });
  it('malformed suspension is not silently interpreted as an eligible firm', async () => {
    db.exec("UPDATE firms SET suspended_until='broken' WHERE id='f'");
    expect(await acceptJobAtomic(db, 'a', 'f')).toMatchObject({ ok: false, status: 403 });
    expect(createOffer(db, 'a', 'f')).toMatchObject({ ok: false, status: 403 });
    expect(provider.authorize).not.toHaveBeenCalled();
  });
});

describe('Standard selection and withdrawal share the reservation boundary', () => {
  it('revalidates capacity at selection when the firm became occupied after offering', async () => {
    const id = offer('a'); occupy('b');
    expect(await selectOffer(db, 'a', id, 'c')).toMatchObject({ ok: false, status: 409 });
    expect(provider.authorize).not.toHaveBeenCalled();
    expect(offers()).toEqual([{ id, status: 'pending' }]);
  });
  it('rejects new offers for a conflicting interval', () => {
    occupy(); expect(createOffer(db, 'b', 'f')).toMatchObject({ ok: false, status: 409 });
    expect(offers()).toEqual([]);
  });
  it('a withdrawal that wins before reservation cannot be selected', async () => {
    const id = offer('a'); expect(withdrawOffer(other, id, 'f')).toMatchObject({ ok: true });
    expect(await selectOffer(db, 'a', id, 'c')).toMatchObject({ ok: false, status: 409 });
    expect(provider.authorize).not.toHaveBeenCalled();
  });
  it('revalidates a withdrawal committed after the outer selection reads', async () => {
    const id = offer('a'); const original = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const statement = original(sql);
      if (sql.includes('SELECT id, firm_id, status FROM offers')) {
        const get = statement.get.bind(statement);
        vi.spyOn(statement, 'get').mockImplementation((...args: unknown[]) => {
          const snapshot = get(...args);
          expect(withdrawOffer(other, id, 'f')).toMatchObject({ ok: true });
          return snapshot;
        });
      }
      return statement;
    });
    expect(await selectOffer(db, 'a', id, 'c')).toMatchObject({ ok: false, status: 409 });
    expect(provider.authorize).not.toHaveBeenCalled();
    expect(offers()).toEqual([{ id, status: 'withdrawn' }]);
  });
  it('withdrawal during authorization is refused, then offers finalize together', async () => {
    const selected = offer('a'), losing = offer('a', 'g');
    const pending = deferred(); const selection = selectOffer(db, 'a', selected, 'c');
    expect(withdrawOffer(other, selected, 'f')).toMatchObject({ ok: false, status: 409 });
    pending.resolve(); expect(await selection).toEqual({ ok: true });
    expect(offers()).toEqual(expect.arrayContaining([{ id: selected, status: 'accepted' }, { id: losing, status: 'rejected' }]));
  });
  it('failed authorization leaves offers pending and permits withdrawal again', async () => {
    const id = offer('a'); provider.authorize.mockRejectedValueOnce(Error('timeout'));
    expect(await selectOffer(db, 'a', id, 'c')).toMatchObject({ ok: false, status: 502 });
    expect(offers()).toEqual([{ id, status: 'pending' }]);
    expect(withdrawOffer(other, id, 'f')).toMatchObject({ ok: true });
  });
  it('a failure updating losing offers rolls back the selected offer too', async () => {
    const selected = offer('a'), losing = offer('a', 'g');
    db.exec("CREATE TRIGGER fail_rejection BEFORE UPDATE ON offers WHEN NEW.status='rejected' BEGIN SELECT RAISE(ABORT,'private-db-error'); END");
    expect(await selectOffer(db, 'a', selected, 'c')).toMatchObject({ ok: false, status: 503 });
    expect(offers()).toEqual(expect.arrayContaining([{ id: selected, status: 'pending' }, { id: losing, status: 'pending' }]));
    expect(state('a')).toEqual({ status: 'accepted', accepted_firm_id: 'f' });
    expect(provider.authorize).toHaveBeenCalledTimes(1);
  });
  it.each(['cancelled', 'no_show', 'arrived', 'completed'])('does not finalize offers after a concurrent %s transition', async status => {
    const id = offer('a'); const pending = deferred(); const selection = selectOffer(db, 'a', id, 'c');
    other.prepare('UPDATE jobs SET status=? WHERE id=?').run(status, 'a');
    pending.resolve(); expect(await selection).toMatchObject({ ok: false, status: 409 });
    expect(offers()).toEqual([{ id, status: 'pending' }]);
  });
  it('duplicate offers from separate connections return one identifier and a deterministic conflict', () => {
    const id = offer('a'); expect(createOffer(other, 'a', 'f')).toMatchObject({ ok: false, status: 409 });
    expect(offers()).toEqual([{ id, status: 'pending' }]);
  });
  it('a wrong owner or changed mode cannot bypass selection inside the claim', async () => {
    const id = offer('a');
    expect(await acceptJobAtomic(db, 'a', 'f', { offerId: id, clientId: 'other' })).toMatchObject({ ok: false, status: 403 });
    db.exec("UPDATE jobs SET mode='express' WHERE id='a'");
    expect(await acceptJobAtomic(db, 'a', 'f', { offerId: id, clientId: 'c' })).toMatchObject({ ok: false, status: 409 });
    expect(provider.authorize).not.toHaveBeenCalled();
  });
});
