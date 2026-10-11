# Payment audit — 11 October 2026

The firm dashboard no longer promises that Stripe is “coming soon”. It explains card authorization, collection after completion evidence, and the separate bank-payment status. The shared dashboard is served to the website and the Capacitor application (`capacitor.config.ts`). This change does not activate Connect transfers or change payment processing.

## Verified application behavior

- Firm acceptance calls `authorizePayment` with `capture_method: manual`. An authorization is recorded only when Stripe confirms `requires_capture` and the full capturable RON amount. Acceptance does not capture or transfer funds.
- Completion requires the accepted firm's validated completion photos, an arrived job, and any applicable execution checklist. `capturePayment` additionally verifies completed status and valid completion evidence before calling Stripe.
- The completion request awaits full capture confirmation. Replaying a confirmed capture does not collect payment twice. Provider errors or expired/cancelled authorizations cannot be treated as a successful collection.
- A firm transfer is a separate operation. It requires `NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED=true`, a completed/captured job, and an active, ready connected account. Without activation, the payment is captured but the transfer is recorded as blocked.
- If activated, a separate transfer is requested after capture, using the charge as `source_transaction`, the server-derived firm amount, and a stable job idempotency key. A failed transfer is recorded independently of the successful collection. There is currently no automatic transfer retry caller; replaying an already captured payment returns before retrying its transfer.

## Current operational evidence

- The connected Stripe account named **NITIDO** was inspected in **live mode**, read-only. Its connected-account and transfer lists are empty (`has_more=false`). PaymentIntent searches for RON and for all creation dates are also empty. These observations establish no live end-to-end payment evidence and no connected recipient ready for a firm transfer in this account.
- Coolify's production environment metadata lists `STRIPE_SECRET_KEY`, but contains no `NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED` or `NEXT_PUBLIC_STRIPE_CONNECT_ONBOARDING` entry. The checked production Compose file does not supply a different default. Secret values were not read or changed.
- A direct, read-only runtime assertion could not be scheduled: Coolify returned HTTP 500 before creating the temporary task. Production task inspection confirmed that no diagnostic task was left behind. This audit does not claim a successful in-container configuration check or that the deployed secret belongs to the connected account.
- No real authorization, capture, refund, transfer or payout was initiated by this audit. The Stripe connector exposed only a live account; no connected sandbox account was available for a financial end-to-end test.

## Validation

99 tests passed across payment lifecycle, payment confirmation, payment splitting/transfers, firm acceptance, proof of work and API proof security. The new lifecycle tests use an in-memory database and a mocked Stripe provider to exercise actual acceptance, arrival, completion, capture and transfer functions. They cover HOLD before completion, missing evidence, one capture on replay, blocked transfers without activation, enabled transfer ordering and separate transfer failure recording. Mocked success is not proof of live financial success.

## Timing and remaining work

Card authorizations expire according to their Stripe/network capture deadline; HOLD is not indefinite. A successful transfer request with `source_transaction` does not mean that funds are immediately available to withdraw. Destination availability follows settlement of the source charge, and a bank payout has its own timing. Neither collection nor receipt in a bank account can be guaranteed within one second.

Before enabling automatic firm transfers, use a dedicated Stripe test environment to verify the intended platform/recipient identities, account onboarding and capability readiness, signed webhook reconciliation, transfer failures/recovery, authorization expiry, and the complete booking flow. Financial activation needs separate approval under `docs/upgrade/MASTER-BRIEF-v1.1.md`, section B.1: “Nicio modificare nouă de procesator, chei, webhook, autorizare/captură, transfer sau payout fără aprobare distinctă.”

Stripe references: [manual capture and authorization deadlines](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method), [separate charges and transfers, balance availability and source transactions](https://docs.stripe.com/connect/separate-charges-and-transfers).
