import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import Sqlite from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCHEMA_SQL } from './db';
import { createOffer, selectOffer } from './offers';
import { authorizePayment } from './payments';
import { recoverSelection, selectionRecoveryState, recordSelectionConfirmation } from './selectionRecovery';
let db: Sqlite.Database;
let path: string;
let directory: string;
let selected: string;
let losing: string;
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('STRIPE_SECRET_KEY', '');
  directory = mkdtempSync(join(tmpdir(), 'nitido-selection-')); path = join(directory, 'db.sqlite');
  db = new Sqlite(path, { timeout: 0 }); db.pragma('journal_mode=WAL'); db.exec(SCHEMA_SQL);
  db.exec(`INSERT INTO users(id,role,name) VALUES('c','client','Client'),('u','firma','Firm'),('v','firma','Other');
    INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('f','u','București',1),('g','v','București',1);
    INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,buffer_minutes,status,mode)
    VALUES('j','c','Test','București',75,'apartament','scheduled','2030-09-13T08:00:00Z',550,60,30,'waiting','standard');`);
  const a = createOffer(db, 'j', 'f'), b = createOffer(db, 'j', 'g');
  if (!a.ok || !b.ok) throw Error('fixture'); selected = a.offerId; losing = b.offerId;
});
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }); vi.unstubAllEnvs(); });
function failFinalization() { db.exec("CREATE TRIGGER fail_offer BEFORE UPDATE ON offers WHEN NEW.status='rejected' BEGIN SELECT RAISE(ABORT,'private-db-error'); END"); }
async function interrupted() { failFinalization(); expect(await selectOffer(db, 'j', selected, 'c')).toMatchObject({ ok: false, status: 503 }); db.exec('DROP TRIGGER fail_offer'); }
const financial = () => db.prepare('SELECT * FROM payments').all();
const offerStates = () => db.prepare('SELECT id,status FROM offers ORDER BY id').all();

describe('durable Standard confirmation recovery', () => {
  it('normal selection commits the receipt and confirms it with the offers', async () => {
    expect(await selectOffer(db, 'j', selected, 'c')).toEqual({ ok: true });
    expect(db.prepare('SELECT status FROM selection_confirmations').get()).toEqual({ status: 'confirmed' });
    expect(selectionRecoveryState(db, 'j', 'c')).toBeNull();
  });
  it('keeps authorization and its receipt when offer finalization fails', async () => {
    await interrupted();
    expect(financial()).toHaveLength(1);
    expect(db.prepare('SELECT status FROM payments').get()).toEqual({ status: 'authorized' });
    expect(db.prepare('SELECT status FROM selection_confirmations').get()).toEqual({ status: 'pending' });
    expect(selectionRecoveryState(db, 'j', 'c')).toBe('pending');
    expect(offerStates()).toEqual(expect.arrayContaining([{ id: selected, status: 'pending' }, { id: losing, status: 'pending' }]));
  });
  it('records the receipt when reusing an existing authorization, without another payment row', async () => {
    const id = await authorizePayment(db, 'j', 550);
    await interrupted();
    expect(db.prepare('SELECT payment_id FROM selection_confirmations').get()).toEqual({ payment_id: id });
    expect(financial()).toHaveLength(1);
    expect(recoverSelection(db, 'j', 'c').ok).toBe(true);
  });
  it('refuses a missing payment or a replacement payment with a different identity', async () => {
    await interrupted();
    db.exec('DELETE FROM payments');
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false);
    db.exec("INSERT INTO payments(id,job_id,amount_gross,amount_net,commission_amount,status) VALUES('replacement','j',550,440,110,'authorized')");
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false);
  });
  it('recovers after closing/reopening the database without financial writes or provider configuration', async () => {
    await interrupted(); const before = financial();
    db.close(); db = new Sqlite(path, { timeout: 0 });
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('STRIPE_SECRET_KEY', '');
    db.exec("CREATE TRIGGER no_payment_write BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT,'payment write forbidden'); END; CREATE TRIGGER no_payment_insert BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT,'payment insert forbidden'); END");
    expect(recoverSelection(db, 'j', 'c')).toEqual({ ok: true, status: 200 });
    expect(financial()).toEqual(before);
    expect(offerStates()).toEqual(expect.arrayContaining([{ id: selected, status: 'accepted' }, { id: losing, status: 'rejected' }]));
    expect(selectionRecoveryState(db, 'j', 'c')).toBeNull();
  });
  it('repeated recovery on another connection is idempotent with one audit event', async () => {
    await interrupted(); const other = new Sqlite(path);
    try {
      expect(recoverSelection(db, 'j', 'c').ok).toBe(true);
      expect(recoverSelection(other, 'j', 'c').ok).toBe(true);
      expect(db.prepare("SELECT COUNT(*) n FROM workflow_audit_log WHERE event_type='STANDARD_SELECTION_RECOVERED'").get()).toEqual({ n: 1 });
    } finally { other.close(); }
  });
  it('does not expose or recover another client’s confirmation', async () => {
    await interrupted(); const before = offerStates();
    expect(selectionRecoveryState(db, 'j', 'other')).toBeNull();
    expect(recoverSelection(db, 'j', 'other').ok).toBe(false); expect(offerStates()).toEqual(before);
  });
  it('does not synthesize a receipt for legacy incomplete selections', () => {
    db.exec("UPDATE jobs SET status='accepted',accepted_firm_id='f'");
    expect(recoverSelection(db, 'j', 'c')).toEqual({ ok: false, status: 409 });
    expect(selectionRecoveryState(db, 'j', 'c')).toBeNull();
  });
  it.each(["status='cancelled'", "status='no_show'", "status='arrived'", "status='completed'", "accepted_firm_id='g'", "mode='express'", 'price_gross=551', 'credit_applied=1'])('refuses a changed job: %s', async mutation => {
    await interrupted(); const before = offerStates(); db.exec(`UPDATE jobs SET ${mutation} WHERE id='j'`);
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false); expect(offerStates()).toEqual(before);
  });
  it.each(["status='cancelled'", "status='captured'", 'amount_gross=1', "stripe_payment_intent_id='pi_changed'", "refund_status='pending'", "dispute_status='needs_response'"])('refuses a changed payment: %s', async mutation => {
    await interrupted(); db.exec(`UPDATE payments SET ${mutation} WHERE job_id='j'`);
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false);
    expect(db.prepare('SELECT status FROM selection_confirmations').get()).toEqual({ status: 'pending' });
  });
  it('does not confirm an older claim after reallocation to the same firm', async () => {
    await interrupted(); db.exec("UPDATE job_acceptance_claims SET token='new-claim'");
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false); expect(selectionRecoveryState(db, 'j', 'c')).toBeNull();
  });
  it('refuses a persisted cancellation request even if the job row still appears accepted', async () => {
    await interrupted(); db.exec("INSERT INTO payment_cancellation_requests(job_id) VALUES('j')");
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false);
  });
  it('does not override a competing accepted offer or a withdrawn chosen offer', async () => {
    await interrupted(); db.prepare("UPDATE offers SET status='accepted' WHERE id=?").run(losing);
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false);
    db.prepare("UPDATE offers SET status='pending' WHERE id=?").run(losing);
    db.prepare("UPDATE offers SET status='withdrawn' WHERE id=?").run(selected);
    expect(recoverSelection(db, 'j', 'c').ok).toBe(false);
  });
  it('rolls back offers, receipt and audit together on recovery failure', async () => {
    await interrupted(); const before = offerStates();
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON workflow_audit_log WHEN NEW.event_type='STANDARD_SELECTION_RECOVERED' BEGIN SELECT RAISE(ABORT,'private-db-error'); END");
    expect(recoverSelection(db, 'j', 'c')).toEqual({ ok: false, status: 503 });
    expect(offerStates()).toEqual(before);
    expect(db.prepare('SELECT status FROM selection_confirmations').get()).toEqual({ status: 'pending' });
  });
  it('keeps a pending receipt when a competing writer prevents recovery', async () => {
    await interrupted(); const other = new Sqlite(path); other.exec('BEGIN IMMEDIATE');
    try { expect(recoverSelection(db, 'j', 'c')).toEqual({ ok: false, status: 503 }); }
    finally { other.exec('ROLLBACK'); other.close(); }
    expect(recoverSelection(db, 'j', 'c').ok).toBe(true);
  });
  it('rolls back a new payment if its durable confirmation receipt cannot be saved', async () => {
    db.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON selection_confirmations BEGIN SELECT RAISE(ABORT,'private-db-error'); END");
    expect(await selectOffer(db, 'j', selected, 'c')).toMatchObject({ ok: false, status: 502 });
    expect(financial()).toEqual([]);
    expect(db.prepare('SELECT status FROM jobs').get()).toEqual({ status: 'waiting' });
  });
  it('requires the payment transaction for recording a receipt', () => {
    expect(() => recordSelectionConfirmation(db, { jobId:'j',claim:'x',offerId:selected,firmId:'f',clientId:'c',priceGross:550,creditApplied:0 }, 'p')).toThrow('SELECTION_TRANSACTION_REQUIRED');
  });
});
