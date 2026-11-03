# Payment validation — isolated review, 3 November 2026

The available Stripe connection exposes one NÍTIDO account in **LIVE mode** and no authorized sandbox/test context. No account-specific API operation, provider write, sandbox provisioning, customer access or bank-record access was performed. The real Stripe end-to-end release gate remains open.

## New integrated proof

`src/lib/internationalPaymentJourney.test.ts` uses in-memory SQLite and the actual application service functions. Stripe is mocked and all other fetch transports throw; the test container has no network.

The synthetic journeys cover:

1. Owned immutable EUR quote → idempotent booking → Standard supplier offer → client selection → verified crew → sufficient authorization → completion proof/checklist → capture and transfer → platform fee event → recipient payout reconciliation → pending refund → successful refund webhook and duplicate replay. Exact cents and the accepted snapshot remain unchanged.
2. RON credit/charge/transfer ledger remains RON while a platform fee is recorded separately in EUR. A conditional source-currency transfer rejection is explicitly simulated: capture remains recorded, transfer is failed with no phantom transfer ID, and the local RON amounts are not rewritten.
3. An uncertain authorization is retried with identical request identity and idempotency key after acceptance compensation; only one local payment is created.
4. An uncertain result older than the conservative retry window is held for reconciliation instead of creating another authorization.
5. A hold whose provider deadline cannot cover the work/buffer is released and cannot be automatically replaced by another hold.

These are service-level integration tests. They do **not** certify Stripe API acceptance, browser 3DS, real webhook delivery/signatures, actual country capability, receipt by a bank or installed mobile packages. The synthetic payout reports are not evidence of real funds movement.

## Source-linked transfer currency requires real validation

Stripe documents that when `source_transaction` ties a transfer to a charge, the transfer currency must match the charge's associated **balance-transaction** currency. Presentment currency alone is insufficient. The current Romanian path requests a RON transfer. If the Spanish platform's charge balance settles in EUR, real compatibility must be checked before enabling that flow; this review neither inspected live charge balances nor changed Romanian currency/pricing rules.

This is an explicit release-validation gap, **not a demonstrated LIVE outage or confirmed rejected transfer**. Native EUR charges/transfers are separately tested in the simulated service journey. No exchange rate or bank receipt is inferred from fee metadata or successful transfer creation.

## Next authorized sandbox run

Use an existing, explicitly authorized NÍTIDO sandbox context with `livemode=false` and separate sandbox credentials/bindings. Keep email, SMS and push delivery disabled, use only synthetic people/providers/cards, and verify the account country/currency and recipient capabilities. Do not switch to the LIVE context or create a new account to work around missing access.

Validate actual request acceptance and 3DS, provider `capture_before` against the work/buffer, replay after uncertain responses, full refund and reversal, and webhook signature/delivery recovery. For the Romanian case, inspect the original charge currency and its balance-transaction currency separately before testing source-linked transfers. Use actual processor conversion evidence when available; do not substitute the website's BNR display rate. Even a sandbox payout marked paid does not establish settlement in the real EUR bank account.

No SDK/API upgrade or account-setting change is included in this review.

## Official references

- [Stripe testing overview](https://docs.stripe.com/testing/overview): isolated test environments and synthetic test data.
- [Testing use cases](https://docs.stripe.com/testing-use-cases): differences between general sandboxes and shared test-mode settings.
- [Separate charges and transfers — transfer availability](https://docs.stripe.com/connect/separate-charges-and-transfers#transfer-availability): source-linked currency constraint and availability rules.
- [Separate charges and transfers integration](https://docs.stripe.com/connect/marketplace/tasks/accept-payment/separate-charges-and-transfers): transfer behavior and the distinction between transfer and payout.
