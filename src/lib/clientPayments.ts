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
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name,
    metadata: { userId },
  });
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customer.id, userId);
  return customer.id;
}

/** Creează o sesiune Stripe Checkout (mod setup) și întoarce URL-ul de redirect. */
export async function createCardSetupSession(db: Database, userId: string, baseUrl: string): Promise<{ configured: boolean; url?: string }> {
  const stripe = getStripeClient();
  if (!stripe) return { configured: false };
  const customerId = await getOrCreateStripeCustomer(db, userId);
  if (!customerId) return { configured: false };

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    payment_method_types: ["card"],
    customer: customerId,
    success_url: `${baseUrl}/client?card=added`,
    cancel_url: `${baseUrl}/client?card=cancelled`,
  });
  return { configured: true, url: session.url ?? undefined };
}

/**
 * După Checkout, sincronizează cardul salvat: ia cea mai recentă metodă de
 * plată a clientului și o setează ca implicită pe cont. Întoarce dacă are card.
 */
export async function syncClientDefaultCard(db: Database, userId: string): Promise<boolean> {
  const stripe = getStripeClient();
  if (!stripe) return false;
  const user = getUser(db, userId);
  if (!user?.stripe_customer_id) return false;

  const methods = await stripe.paymentMethods.list({ customer: user.stripe_customer_id, type: "card", limit: 1 });
  const pm = methods.data[0];
  if (!pm) return false;

  db.prepare("UPDATE users SET stripe_payment_method_id = ? WHERE id = ?").run(pm.id, userId);
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
