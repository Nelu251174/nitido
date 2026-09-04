import type { Database } from "better-sqlite3";
import Stripe from "stripe";

/**
 * Onboarding Stripe Connect pentru firme — piesa care lipsea din fluxul de plăți
 * (vezi payments.ts: destination charge cu application_fee are nevoie de
 * `firms.stripe_account_id`). Aici creăm contul Connect al firmei (tip Express,
 * onboarding găzduit de Stripe) și link-ul de onboarding.
 *
 * Feature-flag pe `STRIPE_SECRET_KEY`, exact ca payments.ts: fără cheie, funcția
 * semnalează `configured: false` și restul aplicației rămâne pe stub — nimic nu
 * se strică dacă cheia nu e încă setată în producție.
 */

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

type OnboardingResult =
  | { configured: false }
  | { configured: true; url: string; accountId: string };

function getFirmStripeAccountId(db: Database, firmId: string): string | null {
  const row = db
    .prepare("SELECT stripe_account_id FROM firms WHERE id = ?")
    .get(firmId) as { stripe_account_id: string | null } | undefined;
  return row?.stripe_account_id ?? null;
}

/**
 * Creează (sau reutilizează) contul Connect al firmei și întoarce un link de
 * onboarding găzduit de Stripe. `baseUrl` e originul aplicației (ex.
 * https://nitido.ro), folosit pentru URL-urile de retur.
 */
export async function createConnectOnboardingLink(
  db: Database,
  firmId: string,
  baseUrl: string
): Promise<OnboardingResult> {
  const stripe = getStripeClient();
  if (!stripe) return { configured: false };

  let accountId = getFirmStripeAccountId(db, firmId);

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "RO",
      // Necesar pentru destination charges cu application_fee (vezi payments.ts).
      capabilities: { transfers: { requested: true } },
      metadata: { firmId },
    });
    accountId = account.id;
    db.prepare("UPDATE firms SET stripe_account_id = ? WHERE id = ?").run(accountId, firmId);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/firma?stripe=refresh`,
    return_url: `${baseUrl}/firma?stripe=return`,
    type: "account_onboarding",
  });

  return { configured: true, url: link.url, accountId };
}
