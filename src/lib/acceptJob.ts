import {flexiblePreference,validateFlexibleConfirmation,FlexibleError} from "./flexibleScheduling";
import {AuthorizationCoverageError,authorizationRequiredUntil,confirmationOpensAt} from './authorizationCoverage';
import {confirmInvitationWinner} from './providerInvitations';
import {jobAssistedOperation,reserveAssistedTeam} from './assistedOperations';
import {MarginError} from './operationalMargin';
import {recordSelectionConfirmation,confirmSelectionReceipt} from "./selectionRecovery";
import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { authorizationMustStop } from '@/lib/paymentCancellation';
import { authorizePayment, connectTransfersEnabled } from '@/lib/payments';
import { firmCoversCity } from '@/lib/text';
import { firmAvailabilityError, type JobTiming } from '@/lib/firmAvailability';

export type AcceptResult = { ok: true } | { ok: false; error: string; status: number; code?: string };
type Selection = { offerId: string; clientId: string;proposalId?:string };
type Firm = {
  id: string; suspended_until: string | null; stripe_account_id: string | null;
  stripe_account_status: string; stripe_transfers_capability: string; verified: number;
  coverage_city: string; coverage_cities_extra: string | null;
};
type Job = JobTiming & { client_id: string; mode: string; status: string; accepted_firm_id: string | null; city: string; price_gross: number; credit_applied: number };
const fail = (error: string, status = 409, code = 'ACCEPT_FAILED'): AcceptResult & { ok: false } => ({ ok: false, error, status, code });

/** Eligibility, stored schedule and reservation share a SQLite writer transaction, including across processes.
 * The provider call runs AFTER commit. The claim token fences all delayed completion/compensation.
 */
export async function acceptJobAtomic(db: Database, jobId: string, firmId: string, selection?: Selection): Promise<AcceptResult> {
  if (db.inTransaction) return fail('Preluarea nu poate porni în interiorul altei tranzacții.');
  const claim = randomUUID();
  let reserved: { ok: true; job: Job; firm: Firm } | (AcceptResult & { ok: false });
  try {
    reserved = db.transaction(() => {
      const firm = db.prepare('SELECT * FROM firms WHERE id=?').get(firmId) as Firm | undefined;
      if (!firm) return fail('Firmă inexistentă', 404);
      if (!firm.verified) return fail('Firma nu este verificată', 403);
      if (firm.suspended_until && (!Number.isFinite(Date.parse(firm.suspended_until)) || Date.parse(firm.suspended_until) > Date.now())) return fail('Firma este suspendată sau starea suspendării necesită verificare', 403);
      if (connectTransfersEnabled() && (!firm.stripe_account_id || firm.stripe_account_status !== 'ready' || firm.stripe_transfers_capability !== 'active')) return fail('Contul Stripe al firmei nu este pregătit pentru transferuri');
      const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId) as Job | undefined;
      if (!job) return fail('Lucrare inexistentă', 404);
      if (selection) {
        if (job.client_id !== selection.clientId) return fail('Lucrarea nu îți aparține', 403);
        if (job.mode !== 'standard') return fail('Lucrarea nu se selectează prin ofertă');
        if (!db.prepare("SELECT 1 FROM offers WHERE id=? AND job_id=? AND firm_id=? AND status='pending'").get(selection.offerId, jobId, firmId)) return fail('Oferta nu mai este validă');
      }
      if (job.status !== 'waiting' || authorizationMustStop(db, jobId)) return fail('Lucrarea nu mai este disponibilă', 409,
        ['accepted', 'arrived'].includes(job.status) && job.accepted_firm_id && job.accepted_firm_id !== firmId ? 'ALREADY_TAKEN' : 'JOB_UNAVAILABLE');
      const flex=flexiblePreference(db,jobId);
      if(flex&&!selection)return fail('Alege și confirmă propunerea firmei în Standard.');
      const proposal=selection?validateFlexibleConfirmation(db,jobId,firmId,selection.offerId,selection.proposalId):null;
      if(proposal){job.scheduled_at=proposal.starts_at;job.when_type='scheduled';}
      const opens=confirmationOpensAt(job);
      if(opens!==null&&Date.now()<opens)return fail('La această programare, acceptarea finală și HOLD-ul se deschid cu 48 de ore înainte de începere. Cererea și ofertele rămân disponibile până atunci.',409,'CONFIRMATION_NOT_OPEN');
      if (!firmCoversCity(firm.coverage_city, firm.coverage_cities_extra, job.city)) return fail('Lucrarea este în afara zonei firmei', 403);
      const unavailable = firmAvailabilityError(db, firmId, job);
      if (unavailable) return fail(unavailable, 409, 'CAPACITY_UNAVAILABLE');
      const updated = db.prepare("UPDATE jobs SET status='accepted',accepted_firm_id=?,accepted_at=datetime('now') WHERE id=? AND status='waiting'").run(firmId, jobId);
      if (updated.changes !== 1) return fail('Lucrarea nu mai este disponibilă');
      if(proposal){
        db.prepare("UPDATE jobs SET scheduled_at=?,when_type='scheduled' WHERE id=?").run(proposal.starts_at,jobId);
        const fu=db.prepare('SELECT user_id FROM firms WHERE id=?').get(firmId) as {user_id:string};
        db.prepare('INSERT INTO workspace_assignments(job_id,team_id,assigned_by,created_at) VALUES(?,?,?,?)').run(jobId,proposal.team_id,fu.user_id,new Date().toISOString());
      }
      reserveAssistedTeam(db,jobId,firmId);
      db.prepare('INSERT INTO job_acceptance_claims(job_id,token) VALUES(?,?) ON CONFLICT(job_id) DO UPDATE SET token=excluded.token').run(jobId, claim);
      return { ok: true as const, job, firm };
    }).immediate();
  } catch (e) {
    if(e instanceof FlexibleError)return fail(e.message,e.status,'FLEXIBLE_UNAVAILABLE');
    if(e instanceof MarginError)return fail(e.message,e.status,'ASSISTED_CAPACITY_UNAVAILABLE');
    return fail('Preluarea nu a putut fi rezervată. Reîncarcă lucrarea și reîncearcă.', 503);
  }
  if (!reserved.ok) return reserved;
  try {
    await authorizePayment(db, jobId, reserved.job.price_gross, reserved.firm.stripe_account_id, reserved.job.credit_applied ?? 0, selection ? paymentId => recordSelectionConfirmation(db, {jobId,claim,offerId:selection.offerId,clientId:selection.clientId,firmId,priceGross:reserved.job.price_gross,creditApplied:reserved.job.credit_applied}, paymentId) : undefined,{requiredUntil:authorizationRequiredUntil(reserved.job)});
  } catch (error) {
    try {
      db.transaction(()=>{const released=db.prepare(`UPDATE jobs SET status='waiting',accepted_firm_id=NULL,accepted_at=NULL
        WHERE id=? AND status='accepted' AND accepted_firm_id=?
        AND EXISTS(SELECT 1 FROM job_acceptance_claims WHERE job_id=? AND token=?)`).run(jobId, firmId, jobId, claim);
      if(released.changes){if(flexiblePreference(db,jobId))db.prepare('DELETE FROM workspace_assignments WHERE job_id=?').run(jobId);const p=jobAssistedOperation(db,jobId);if(p)db.prepare('DELETE FROM workspace_assignments WHERE job_id=? AND team_id=?').run(jobId,p.teamId);}
      }).immediate();
    } catch {
      return fail('Starea preluării necesită verificare. Reîncarcă lucrarea; rezervarea nu a fost eliberată.', 503);
    }
    if(error instanceof AuthorizationCoverageError)return fail(error.code==='HOLD_RELEASE_PENDING'?'Autorizarea nu acoperă intervenția. Eliberarea HOLD-ului este în curs; nu iniția o plată nouă.':'Autorizarea cardului nu acoperă intervenția și bufferul. Rezervarea nu a fost confirmată. Nu se va crea automat alt HOLD; reconfigurează cererea sau contactează asistența.',409,error.code);
    return fail('Autorizarea plății nu a putut fi confirmată. Reîncarcă starea lucrării.', 502);
  }
  try {
    return db.transaction(() => {
      const current = db.prepare(`SELECT 1 FROM jobs j JOIN job_acceptance_claims c ON c.job_id=j.id
        WHERE j.id=? AND j.status='accepted' AND j.accepted_firm_id=? AND c.token=?`).get(jobId, firmId, claim);
      if (!current || authorizationMustStop(db, jobId)) return fail('Starea lucrării s-a schimbat în timpul autorizării. Reîncarcă lucrarea.');
      if (selection) {
        if (!db.prepare("SELECT 1 FROM offers WHERE id=? AND job_id=? AND firm_id=? AND status='pending'").get(selection.offerId, jobId, firmId)) return fail('Oferta necesită reconciliere. Reîncarcă lucrarea.');
        db.prepare("UPDATE offers SET status='accepted',updated_at=datetime('now') WHERE id=?").run(selection.offerId);
        db.prepare("UPDATE offers SET status='rejected',updated_at=datetime('now') WHERE job_id=? AND id!=? AND status='pending'").run(jobId, selection.offerId);
        confirmSelectionReceipt(db, jobId, claim);
      }
      confirmInvitationWinner(db,jobId,firmId,claim);
      return { ok: true as const };
    }).immediate();
  } catch {
    // Provider success is not undone by a local finalization error; keep the reservation for reconciliation.
    return fail('Confirmarea locală necesită verificare. Reîncarcă lucrarea; nu iniția o plată nouă.', 503);
  }
}
