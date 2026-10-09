import { randomBytes, createHash } from "node:crypto";
import { CardSetupError, activeCards, saveConfirmedCard, updateCardDetails } from "./savedCards";
export { CardSetupError } from "./savedCards";
import type { Database } from "better-sqlite3";
import { getStripeClient } from "@/lib/payments";

/** Up to three saved cards, collected through Stripe-hosted Checkout. */

type UserRow = { id: string; email: string | null; name: string; stripe_customer_id: string | null; stripe_payment_method_id: string | null };

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
  }, { idempotencyKey: `nitido-customer-${createHash("sha256").update(`${userId}:${user.stripe_customer_id ?? "new"}`).digest("hex")}` });
  return db.transaction(() => {
    const current = getUser(db,userId);
    if (current?.stripe_customer_id !== user.stripe_customer_id) return current?.stripe_customer_id ?? null;
    db.prepare("UPDATE client_saved_cards SET slot=NULL WHERE user_id=?").run(userId);
    db.prepare("UPDATE users SET stripe_customer_id=?,stripe_payment_method_id=NULL WHERE id=?").run(customer.id,userId);
    return customer.id;
  }).immediate();
}

/** Creează o sesiune Stripe Checkout (mod setup) și întoarce URL-ul de redirect. */
export async function createCardSetupSession(db: Database, userId: string, baseUrl: string, mobile = false): Promise<{ configured: boolean; url?: string; sessionId?: string }> {
  const stripe = getStripeClient();
  if (!stripe) return { configured: false };
  const customerId = await getOrCreateStripeCustomer(db, userId);
  if (!customerId) return { configured: false };
  if (activeCards(db,userId).length >= 3) throw new CardSetupError("Ai deja 3 carduri salvate. Elimină unul înainte să adaugi un card nou.");

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    payment_method_types: ["card"],
    customer: customerId,
    client_reference_id: userId,
    metadata: { flow: "saved_cards_v1" },
    integration_identifier: `nitido_saved_cards_${Array.from(randomBytes(8), n => String.fromCharCode(97+n%26)).join("")}`,
    success_url: mobile ? `${baseUrl}/card-finalizat` : `${baseUrl}/client?card=added&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: mobile ? `${baseUrl}/card-finalizat` : `${baseUrl}/client?card=cancelled`,
  });
  return { configured: true, url: session.url ?? undefined, sessionId: session.id };
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
      !(session.metadata?.flow === "saved_cards_v1" || typeof session.metadata?.previousPaymentMethodId === "string") || !setupId) {
    throw new CardSetupError("Salvarea cardului nu este confirmată pentru contul tău.");
  }
  const setup = await stripe.setupIntents.retrieve(setupId);
  const methodId = idOf(setup.payment_method);
  if (setup.id !== setupId || setup.status !== "succeeded" || idOf(setup.customer) !== user.stripe_customer_id || !methodId) {
    throw new CardSetupError("Cardul nu a fost confirmat de Stripe. Cardurile existente sunt păstrate.");
  }
  const pm = await stripe.paymentMethods.retrieve(methodId);
  if (pm.id !== methodId || pm.type !== "card" || !pm.card || idOf(pm.customer) !== user.stripe_customer_id) {
    throw new CardSetupError("Cardul nu corespunde contului tău.");
  }
  saveConfirmedCard(db,userId,user.stripe_customer_id,pm.id,sessionId,pm.card);
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

/** Expose only local card IDs and masked details, never customer IDs or full card data. */
export async function getClientCards(db: Database,userId: string) {
  const stripe=getStripeClient();
  const cards=activeCards(db,userId);
  for (const card of cards) {
    if (card.last4 || !stripe) continue;
    const pm=await stripe.paymentMethods.retrieve(card.payment_method_id);
    if (pm.id!==card.payment_method_id || idOf(pm.customer)!==card.customer_id || pm.type!=="card" || !pm.card) {
      throw new CardSetupError("Detaliile cardului existent nu pot fi confirmate. Reîncearcă.");
    }
    updateCardDetails(db,card.id,pm.card);
  }
  const info=getClientCardInfo(db,userId);
  return {hasCard:info.hasCard,stripeConfigured:info.stripeConfigured,maxCards:3,cards:activeCards(db,userId).map(card=>({
    id:card.id,brand:card.brand,last4:card.last4,expMonth:card.exp_month,expYear:card.exp_year,
    isDefault:card.payment_method_id===info.paymentMethodId,
  }))};
}
