import type { Database } from "better-sqlite3";
import Stripe from "stripe";
import { newId } from "@/lib/db";
import { calcNetForFirm, PLATFORM_COMMISSION } from "@/lib/pricing";

/**
 * Plăți — spec secțiunea 5b/10: Stripe Connect, "destination charge cu application fee",
 * model hold (autorizare) → capturare la finalizare confirmată.
 *
 * Feature-flag pe `STRIPE_SECRET_KEY`: dacă lipsește din `.env`, tot fluxul funcționează
 * ca înainte — un stub local care scrie direct în tabelul `payments`, suficient ca
 * mecanismul de business (comision, hold/capturare/anulare) să fie testabil cap-coadă
 * fără cont Stripe. De îndată ce pui cheia (cont Stripe Connect, mod test sau live),
 * codul de mai jos face apeluri reale, fără nicio altă schimbare necesară în restul
 * aplicației — `acceptJobAtomic`, ruta de finalizare și cea de no-show rămân neschimbate.
 *
 * Notă: pentru un destination charge real e nevoie și de `firms.stripe_account_id`
 * (cont Stripe Connect al firmei, obținut prin fluxul de onboarding Stripe — neconstruit
 * încă, vezi README). Fără el, cu cheia setată, se face un PaymentIntent normal (manual
 * capture) în contul platformei — split-ul 18/82 rămâne calculat corect în baza de date,
 * doar transferul automat către firmă nu se întâmplă până nu există cont Connect legat.
 */

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function authorizePayment(
  db: Database,
  jobId: string,
  grossAmount: number,
  firmStripeAccountId?: string | null,
  discountAmount: number = 0
): Promise<string> {
  // Firma primește mereu pe baza prețului INTEGRAL contractat (grossAmount) —
  // un credit de recomandare (vezi src/lib/referral.ts) nu trebuie să-i
  // reducă firmei plata; discount-ul e absorbit din comisionul platformei.
  // Vezi folosirea în src/lib/acceptJob.ts.
  const netAmount = calcNetForFirm(grossAmount);
  const chargeAmount = Math.max(netAmount, grossAmount - Math.max(0, discountAmount));
  const commissionAmount = chargeAmount - netAmount;
  const id = newId("pay");

  const stripe = getStripeClient();
  let stripePaymentIntentId: string | null = null;

  if (stripe) {
    // Sumele Stripe sunt în bani (cel mai mic subunit monetar) — pentru RON, bani.
    const params: Stripe.PaymentIntentCreateParams = {
      amount: chargeAmount * 100,
      currency: "ron",
      capture_method: "manual", // hold, nu capturare imediată — spec secțiunea 5b
      metadata: { jobId },
    };
    if (firmStripeAccountId) {
      params.application_fee_amount = commissionAmount * 100;
      params.transfer_data = { destination: firmStripeAccountId };
    }
    try {
      const intent = await stripe.paymentIntents.create(params);
      stripePaymentIntentId = intent.id;
    } catch (err) {
      // O autorizare Stripe eșuată nu trebuie să lase lucrarea într-o stare
      // inconsistentă — apelantul (acceptJobAtomic) revine pe 'waiting' dacă asta aruncă.
      throw new Error(
        `Autorizare Stripe eșuată: ${err instanceof Error ? err.message : "eroare necunoscută"}`
      );
    }
  }

  db.prepare(
    `INSERT INTO payments (id, job_id, amount_gross, commission_amount, amount_net, status, stripe_payment_intent_id)
     VALUES (?, ?, ?, ?, ?, 'authorized', ?)`
  ).run(id, jobId, chargeAmount, commissionAmount, netAmount, stripePaymentIntentId);

  return id;
}

export async function capturePayment(db: Database, jobId: string): Promise<void> {
  const payment = db
    .prepare("SELECT * FROM payments WHERE job_id = ? AND status = 'authorized'")
    .get(jobId) as { id: string; stripe_payment_intent_id: string | null } | undefined;
  if (!payment) return;

  const stripe = getStripeClient();
  if (stripe && payment.stripe_payment_intent_id) {
    await stripe.paymentIntents.capture(payment.stripe_payment_intent_id);
  }

  db.prepare(`UPDATE payments SET status = 'captured' WHERE id = ?`).run(payment.id);
}

export async function cancelPayment(db: Database, jobId: string): Promise<void> {
  const payment = db
    .prepare("SELECT * FROM payments WHERE job_id = ? AND status = 'authorized'")
    .get(jobId) as { id: string; stripe_payment_intent_id: string | null } | undefined;
  if (!payment) return;

  const stripe = getStripeClient();
  if (stripe && payment.stripe_payment_intent_id) {
    await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id);
  }

  db.prepare(`UPDATE payments SET status = 'cancelled' WHERE id = ?`).run(payment.id);
}

export const COMMISSION_RATE = PLATFORM_COMMISSION;
