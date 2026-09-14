import type { Database } from "better-sqlite3";
import { getStripeClient } from "@/lib/payments";

/**
 * Plata clientului — "card pe fișier". Clientul își salvează cardul o singură
 * dată, prin Stripe Checkout în mod `setup` (pagină găzduită de Stripe, care
 * se ocupă de securitate/3D Secure). La acceptarea unei lucrări se pune HOLD
 * pe acest card (off-session), iar la finalizare se încasează (capture) —
 * vezi authorizePayment/capturePayment din payments.ts.
 *
 * Feature-flag pe STRIPE_SECRET_KEY: fără cheie, totul e no-op și aplicația
 * rămâne pe stub (comportament neschimbat).
 */

type UserRow = { id: string; email: string | null; name: string; stripe_customer_id: string | null; stripe_payment_method_id: string | null };

export class CardSetupError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const idOf = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;

function getUser(db: Database, userId: string): UserRow | undefined {
  return db
    .prepare("SELECT id, email, name, stripe_customer_id, stripe_payment_method_id FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
}

/** Returnează (creând la nevoie) id-ul de client Stripe pentru un utilizator. */
export async function getOrCreateStripeCustomer(db: Database, userId: string): Promise<string | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  const user = getUser(db, userId);
  if (!user) throw new Error("Utilizator inexistent");

  // Dacă avem un id de client salvat, verificăm că mai există efectiv în contul
  // Stripe curent. După o schimbare de cheie/cont Stripe, id-ul vechi devine
  // invalid ("No such customer") — în acel caz îl recreăm, ca fluxul de adăugare
  // card să se autorepare în loc să dea eroare.
  if (user.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(user.stripe_customer_id);
      if (existing && !(existing as { deleted?: boolean }).deleted) {
        return user.stripe_customer_id;
      }
    } catch (error) {
      // A network/provider failure must not replace the customer and clear their card.
      if ((error as { code?: string }).code !== "resource_missing") throw error;
    }
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name,
    metadata: { userId },
  });
  // Resetăm și metoda de plată salvată: noul client nu are cardurile vechi.
  db.prepare("UPDATE users SET stripe_customer_id = ?, stripe_payment_method_id = NULL WHERE id = ?").run(
    customer.id,
    userId
  );
  return customer.id;
}

/** Creează o sesiune Stripe Checkout (mod setup) și întoarce URL-ul de redirect. */
export async function createCardSetupSession(db: Database, userId: string, baseUrl: string): Promise<{ configured: boolean; url?: string }> {
  const stripe = getStripeClient();
  if (!stripe) return { configured: false };
  const customerId = await getOrCreateStripeCustomer(db, userId);
  if (!customerId) return { configured: false };
  const previousCard = getUser(db, userId)?.stripe_payment_method_id ?? "";

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    payment_method_types: ["card"],
    customer: customerId,
    client_reference_id: userId,
    metadata: { previousPaymentMethodId: previousCard },
    success_url: `${baseUrl}/client?card=added&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/client?card=cancelled`,
  });
  return { configured: true, url: session.url ?? undefined };
}

/**
 * Confirm only the card from this owner's completed Checkout session.
 * Existing authorizations keep their original payment method; no card is detached.
 */
export async function syncClientDefaultCard(db: Database, userId: string, sessionId: string): Promise<boolean> {
  if (!/^cs_[A-Za-z0-9_]{1,240}$/.test(sessionId)) {
    throw new CardSetupError("Sesiunea cardului lipsește sau este invalidă. Pornește din nou adăugarea cardului.", 400);
  }
  const stripe = getStripeClient();
  if (!stripe) return false;
  const user = getUser(db, userId);
  if (!user?.stripe_customer_id) return false;

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const setupId = idOf(session.setup_intent);
  if (session.id !== sessionId || session.mode !== "setup" || session.status !== "complete" ||
      session.client_reference_id !== userId || idOf(session.customer) !== user.stripe_customer_id ||
      typeof session.metadata?.previousPaymentMethodId !== "string" || !setupId) {
    throw new CardSetupError("Salvarea cardului nu este confirmată pentru contul tău.");
  }
  const setup = await stripe.setupIntents.retrieve(setupId);
  const methodId = idOf(setup.payment_method);
  if (setup.id !== setupId || setup.status !== "succeeded" || idOf(setup.customer) !== user.stripe_customer_id || !methodId) {
    throw new CardSetupError("Cardul nu a fost confirmat de Stripe. Cardul anterior este păstrat.");
  }
  const pm = await stripe.paymentMethods.retrieve(methodId);
  if (pm.id !== methodId || pm.type !== "card" || !pm.card || idOf(pm.customer) !== user.stripe_customer_id) {
    throw new CardSetupError("Cardul nu corespunde contului tău.");
  }
  // Compare-and-set also rejects a late return from another tab after a newer change.
  db.transaction(() => {
    const current = getUser(db, userId);
    if (current?.stripe_customer_id !== user.stripe_customer_id) throw new CardSetupError("Contul de plată s-a schimbat. Reîncearcă.");
    if (current.stripe_payment_method_id === pm.id) return; // Idempotent confirmation.
    const changed = db.prepare("UPDATE users SET stripe_payment_method_id = ? WHERE id = ? AND stripe_customer_id = ? AND stripe_payment_method_id IS ?")
      .run(pm.id, userId, user.stripe_customer_id, session.metadata!.previousPaymentMethodId || null);
    if (changed.changes !== 1) throw new CardSetupError("Cardul a fost schimbat între timp. Reîncarcă pagina înainte de o nouă schimbare.");
  })();
  return true;
}

/** Starea cardului clientului, pentru UI și pentru validarea la postare. */
export function getClientCardInfo(db: Database, userId: string): { hasCard: boolean; stripeConfigured: boolean; customerId: string | null; paymentMethodId: string | null } {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const user = getUser(db, userId);
  return {
    hasCard: Boolean(user?.stripe_payment_method_id),
    stripeConfigured,
    customerId: user?.stripe_customer_id ?? null,
    paymentMethodId: user?.stripe_payment_method_id ?? null,
  };
}
