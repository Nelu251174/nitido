# Independent completion review — 3 November 2026

> Historical review snapshot. Its test totals and account-access observations predate the shared web/mobile integration and GPS work. The current runtime candidate is documented in `international-location-2026-11-03.md`; current Stripe access limitations are documented in `payment-validation-2026-11-03.md`. Two TEST contexts are now authorized, although the required processor operations/configuration read are still unavailable. This snapshot does not approve tariffs or certify a LIVE release.

This extends draft PR 182 without deployment or changes to LIVE. Romanian tariff configuration and existing financial production modules are unchanged in this round.

## Work completed

- Reread 197 direct-source/candidate URLs across the 26 foreign EU markets and 78 canonical cities;188 were successfully read. The merged, dated research history now contains 373 source–city assignments across 327 canonical URLs.226 assignments were refreshed,69 were added, and 18 formerly numeric assignments were downgraded when current evidence did not support the previous classification.
- Kept quote-only pages, inaccessible pages, market guides, intermediaries, unrelated services and conflicting prices explicit. Different sites/brands do not certify independent legal suppliers. Source publication counts are not market-readiness counts. Zero commercial tariffs or new markets were approved/activated.
- Independently reviewed 88 conditional comparison scenarios with 235 numeric checks, all passing.34 require billed-hour or assumed-crew wording;54 retain explicit published rate units. None is a supplier-accepted final invoice or NÍTIDO tariff. Supplier minima sometimes prohibit a three-hour visit; a minimum engagement is not automatically a purchasable three-hour visit billed for longer.
- Recorded dated ECB reference rates from 2 November 2026 for comparative EUR equivalents only. These research conversions do not alter application FX, Romanian prices, charge currency or settlement configuration. Rates are not transaction quotes.
- Separated the operational country/city scope (3,999 bytes) from the bulk public research file (>1 MB), so database initialization does not load competitor research. A dependency-boundary test verifies this and preserves the exact 26/78 operational scope.
- Reproduced and fixed a concurrent verification-email resend rollback bug. Two failed overlapping attempts could restore a failed attempt's token instead of the earlier usable link. A per-account 30-second durable lease now serializes send attempts; claim/token creation is atomic, provider I/O is outside the transaction, rollback rechecks lease/token/account/address, and cleanup only releases the owned lease. Existing schema initialization adds the lease table without rewriting prior confirmation records.
- Hardened read-only email diagnostics for malformed rows and invalid dates; added coarse account/link state diagnosis for the older LIVE schema. It returns no recipient email, token/hash, body, credential value or private raw log.
- Added five integrated service-level payment journeys using real in-memory SQLite and simulated Stripe: quote/booking replay, real offer/selection and verified crew, proof/checklist, capture/transfer, fee event, payout trace, refund and webhook replay, uncertain authorization and coverage failure. Production payment modules were not changed.

## Evidence

Candidate full suite:3,209 passed,0 failed,1 pre-existing omission. Next 16.4.3 production build, TypeScript, changed-source ESLint and i 18 n prebuild passed; nine locale catalogs remain unchanged. Actual isolated Next browser checks cover the updated research register, signup, client/admin separation and denial of unapproved quotes. No physical-device or real-provider test is implied.

## Remaining gates

- Public research still lacks supplier-confirmed comparable final commercial conditions for all requested property/crew scenarios. Final tariff selection, local coverage, actual verified workforce and VAT/contractual responsibility remain release prerequisites.
- Stripe connector discovery exposes one LIVE account and zero authorized sandbox contexts. No account-specific financial records or provider writes were performed. Real processor end-to-end certification remains open.
- Stripe requires a transfer linked by `source_transaction` to match the associated charge balance-transaction currency. A Romanian RON charge may have EUR settlement on the Spanish platform; bank/default currency alone does not prove the actual transaction currency. The new test explicitly simulates rejection of an incompatible RON source-linked transfer and verifies that the captured RON ledger survives while transfer failure remains visible. This is not a demonstrated LIVE incident or a verified supported RON→EUR transfer. Existing Romanian production behavior was not changed.
- Current authorized Coolify metadata access succeeds, but log access returns 403. No saved authenticated Coolify browser profile or authorized email-provider metadata access is available. Therefore the previous LIVE missing-email incident and Gmail receipt remain unconfirmed. The prepared CLI is read-only and sends nothing.
- Joint owner/team review and explicit release approval remain required. All production activation flags remain untouched/off; this branch is still a draft.

References: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html ; https://docs.stripe.com/connect/separate-charges-and-transfers ; docs/payment-validation-2026-11-03.md ; docs/email-diagnostics-2026-11-02.md .
