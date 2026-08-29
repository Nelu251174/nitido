import type { Database } from "better-sqlite3";
import Stripe from "stripe";
import { newId } from "@/lib/db";
import { calcNetForFirm, PLATFORM_COMMISSION } from "@/lib/pricing";

/**
 * Plăți Stripe Connect cu manual capture.
 * În development/test este permis fallback-ul local pentru a testa fluxul fără Stripe.
 * În production lipsa STRIPE_SECRET_KEY este un hard fail: nu marcăm niciodată o
 * plată drept autorizată dacă nu există o autorizare reală la procesator.
 */
function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("STRIPE_SECRET_KEY lipsește în production");
    }
    return null;
  }
  return new Stripe(key);
}

export async function authorizePayment(
  db: Database,
  jobId: string,
  grossAmount: number,
  firmStripeAccountId?: string | null,
  discountAmount: number = 0
): Promise<string> {
  const netAmount = calcNetForFirm(grossAmount);
  const chargeAmount = Math.max(netAmount, grossAmount - Math.max(0, discountAmount));
  const commissionAmount = chargeAmount - netAmount;
  const id = newId("pay");

  const stripe = getStripeClient();
  let stripePaymentIntentId: string | null = null;

  if (stripe) {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: chargeAmount * 100,
      currency: "ron",
      capture_method: "manual",
      metadata: { jobId },
    };
    if (firmStripeAccountId) {
      params.application_fee_amount = commissionAmount * 100;
      params.transfer_data = { destination: firmStripeAccountId };
    }
    try {
      const intent = await stripe.paymentIntents.create(params, {
        idempotencyKey: `nitido-authorize-${jobId}`,
      });
      stripePaymentIntentId = intent.id;
    } catch (err) {
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
    await stripe.paymentIntents.capture(payment.stripe_payment_intent_id, {}, {
      idempotencyKey: `nitido-capture-${jobId}`,
    });
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
    await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id, {}, {
      idempotencyKey: `nitido-cancel-${jobId}`,
    });
  }

  db.prepare(`UPDATE payments SET status = 'cancelled' WHERE id = ?`).run(payment.id);
}

export const COMMISSION_RATE = PLATFORM_COMMISSION;
