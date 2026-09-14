import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { authorizationMustStop } from './paymentCancellation';

export const SELECTION_RECOVERY_SCHEMA = `
CREATE TABLE IF NOT EXISTS selection_confirmations (
 claim_token TEXT PRIMARY KEY,job_id TEXT NOT NULL,offer_id TEXT NOT NULL,firm_id TEXT NOT NULL,
 client_id TEXT NOT NULL,payment_id TEXT NOT NULL,amount_gross INTEGER NOT NULL,
 price_gross INTEGER NOT NULL,credit_applied INTEGER NOT NULL,intent_id TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS selection_confirmations_job ON selection_confirmations(job_id,status);
`;
type SelectionProof = { claim_token: string; job_id: string; offer_id: string; firm_id: string; client_id: string; payment_id: string; amount_gross: number; price_gross: number; credit_applied: number; intent_id: string | null; status: string };
type Decision = { jobId: string; claim: string; offerId: string; firmId: string; clientId: string; priceGross: number; creditApplied: number };

/** Called only in the transaction that persists/revalidates an authorized payment. */
export function recordSelectionConfirmation(db: Database, decision: Decision, paymentId: string) {
  if (!db.inTransaction) throw Error('SELECTION_TRANSACTION_REQUIRED');
  const job = db.prepare(`SELECT j.price_gross,j.credit_applied FROM jobs j JOIN job_acceptance_claims c ON c.job_id=j.id
    JOIN offers o ON o.job_id=j.id WHERE j.id=? AND c.token=? AND j.status='accepted' AND j.mode='standard'
    AND j.accepted_firm_id=? AND j.client_id=? AND o.id=? AND o.firm_id=? AND o.status='pending'`).get(decision.jobId, decision.claim, decision.firmId, decision.clientId, decision.offerId, decision.firmId) as { price_gross: number; credit_applied: number } | undefined;
  const payment = db.prepare("SELECT amount_gross,stripe_payment_intent_id FROM payments WHERE id=? AND job_id=? AND status='authorized'").get(paymentId, decision.jobId) as { amount_gross: number; stripe_payment_intent_id: string | null } | undefined;
  if (!job || !payment || job.price_gross !== decision.priceGross || job.credit_applied !== decision.creditApplied || authorizationMustStop(db, decision.jobId)) throw Error('SELECTION_PROOF_MISMATCH');
  db.prepare(`INSERT INTO selection_confirmations(claim_token,job_id,offer_id,firm_id,client_id,payment_id,amount_gross,price_gross,credit_applied,intent_id)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(decision.claim, decision.jobId, decision.offerId, decision.firmId, decision.clientId, paymentId, payment.amount_gross, job.price_gross, job.credit_applied, payment.stripe_payment_intent_id);
}

function currentProof(db: Database, jobId: string): SelectionProof | undefined {
  return db.prepare(`SELECT s.* FROM selection_confirmations s JOIN job_acceptance_claims c ON c.job_id=s.job_id AND c.token=s.claim_token
    WHERE s.job_id=?`).get(jobId) as SelectionProof | undefined;
}

/** Minimal owner-facing state. No tokens, payment IDs or historical claims leave this function. */
export function selectionRecoveryState(db: Database, jobId: string, clientId: string): 'pending' | null {
  const proof = currentProof(db, jobId);
  if (!proof || proof.client_id !== clientId || proof.status !== 'pending') return null;
  return db.prepare("SELECT 1 FROM jobs WHERE id=? AND client_id=? AND status='accepted' AND accepted_firm_id=?").get(jobId, clientId, proof.firm_id) ? 'pending' : null;
}

/** Local confirmation only: no Stripe import/calls and no payment/job status writes. */
export function recoverSelection(db: Database, jobId: string, clientId: string): { ok: boolean; status: number } {
  try {
    return db.transaction(() => {
      const proof = currentProof(db, jobId);
      if (!proof || proof.client_id !== clientId) return { ok: false, status: 409 };
      const job = db.prepare('SELECT client_id,status,mode,accepted_firm_id,price_gross,credit_applied FROM jobs WHERE id=?').get(jobId) as { client_id: string; status: string; mode: string; accepted_firm_id: string | null; price_gross: number; credit_applied: number } | undefined;
      if (!job || job.client_id !== clientId) return { ok: false, status: 403 };
      if (job.status !== 'accepted' || job.mode !== 'standard' || job.accepted_firm_id !== proof.firm_id || job.price_gross !== proof.price_gross || job.credit_applied !== proof.credit_applied || authorizationMustStop(db, jobId)) return { ok: false, status: 409 };
      const payments = db.prepare('SELECT id,status,amount_gross,stripe_payment_intent_id,refund_status,dispute_status FROM payments WHERE job_id=?').all(jobId) as { id: string; status: string; amount_gross: number; stripe_payment_intent_id: string | null; refund_status: string; dispute_status: string }[];
      const payment = payments[0];
      if (payments.length !== 1 || payment.id !== proof.payment_id || payment.status !== 'authorized' || payment.amount_gross !== proof.amount_gross || payment.stripe_payment_intent_id !== proof.intent_id || payment.refund_status !== 'none' || payment.dispute_status !== 'none') return { ok: false, status: 409 };
      const offer = db.prepare('SELECT firm_id,status FROM offers WHERE id=? AND job_id=?').get(proof.offer_id, jobId) as { firm_id: string; status: string } | undefined;
      if (!offer || offer.firm_id !== proof.firm_id || offer.status !== (proof.status === 'confirmed' ? 'accepted' : 'pending')) return { ok: false, status: 409 };
      if (db.prepare("SELECT 1 FROM offers WHERE job_id=? AND id!=? AND status='accepted'").get(jobId, proof.offer_id)) return { ok: false, status: 409 };
      if (proof.status === 'confirmed') return { ok: true, status: 200 };
      db.prepare("UPDATE offers SET status='accepted',updated_at=datetime('now') WHERE id=?").run(proof.offer_id);
      db.prepare("UPDATE offers SET status='rejected',updated_at=datetime('now') WHERE job_id=? AND id!=? AND status='pending'").run(jobId, proof.offer_id);
      confirmSelectionReceipt(db, jobId, proof.claim_token);
      db.prepare("INSERT INTO workflow_audit_log(id,event_type,job_id,details) VALUES(?,'STANDARD_SELECTION_RECOVERED',?,?)").run(randomUUID(), jobId, JSON.stringify({ offerId: proof.offer_id, clientId }));
      return { ok: true, status: 200 };
    }).immediate();
  } catch { return { ok: false, status: 503 }; }
}

export function confirmSelectionReceipt(db: Database, jobId: string, claim: string) {
  if (!db.inTransaction) throw Error('SELECTION_TRANSACTION_REQUIRED');
  db.prepare("UPDATE selection_confirmations SET status='confirmed',confirmed_at=CURRENT_TIMESTAMP WHERE job_id=? AND claim_token=? AND status='pending'").run(jobId, claim);
}
