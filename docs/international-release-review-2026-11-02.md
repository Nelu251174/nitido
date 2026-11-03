# International pricing: isolated release review, 2 November 2026

> Historical snapshot for 2 November. Its counts and test totals are superseded by [the 3 November independent review](independent-work-review-2026-11-03.md) and the final release verification. Do not use this snapshot as current release approval. No commercial tariff was approved by this document.

This branch is a review candidate, not a LIVE release. Production source at the start of this work was `a91fcdcd78321a2560ad30663c8a95ee6c893201` on `codex/workspace-logo-fix-20261031`. The local starting tree was identical. No deployment, LIVE mutation, payment, booking, supplier outreach, email or push delivery was performed.

## Implemented and tested

- An ADMIN-only research/draft register for 26 EU countries excluding Romania, with 78 selected cities. The manifest contains 304 source–city assignments across 274 unique source URLs; publication does not imply independent firms, comparable services or commercial approval.
- Server-issued, client-bound, expiring and immutable EUR quotes. Integer cents, explicit VAT and once-per-visit fees; worker-hours and team-hours remain different. Minimum three hours on site, supplier minima, scope and crew are enforced.
- Atomic quote acceptance, own-account isolation, request replay and durable push enqueue. Time and expiry are checked after the writer lock. Scheduling uses the work country's IANA timezone, rejects ambiguous/nonexistent local times and does not use the visitor's browser timezone as the work timezone.
- Persisted administrative attestations for physical team capacity. Membership, coverage and Connect readiness alone do not prove a workforce. No positive attestations are seeded for real suppliers.
- EUR authorization, SCA, capture, transfer, cancellation, refund and recovery use stored cents/currency. Provider country must match the accepted work country. Romanian whole-lei commission and credit rules remain covered by regression tests.
- Display and financial reads distinguish stored EUR from converted RON, avoid double FX conversion, and separate totals by currency.
- Verification email handling distinguishes acceptance from delivery, uses bounded retry/idempotency, rejects malformed success responses and records redacted technical diagnostics. ADMIN diagnostics and the read-only CLI expose no password, token, email body or customer email address.
- Nine existing published locale catalogs are preserved and extended by 326 messages each. Existing 5,439 message IDs and translations are preserved. Test fixtures are excluded from extraction.

## Verification evidence

The pristine baseline passed 2,897 tests, with one existing omission. The consolidated candidate passed 3,191 tests, zero failures and the same one omission across 305 test files. Production Next.js 16.4.3 build, TypeScript, changed-source ESLint and `npm run prebuild` passed. The isolated actual Next browser run passed 13 checks, including synthetic ADMIN login, anonymous/client ADMIN denial, signup with unavailable mail transport, unapproved quote denial and responsive rendering. A separate React/API fixture harness passed 31 UI checks, including a synthetic positive quote flow and work-local scheduling in a US browser timezone.

These are isolated tests. Stripe responses in financial tests are simulated; queue insertion is not phone delivery; an accepted email is not Gmail receipt. Browser screenshots are not physical iPhone/Android or store-package certification.

## Deliberate boundaries

Romanian tariff, quote and scheduling configuration is retained. Existing RON pricing routes are not replaced by the international route. The new EUR creation endpoint rejects RON-only credits, Express60, properties, beneficiary/host and recurring integrations. Unsupported EUR legacy reports, automatic rescue/repost and automatic remedial cloning fail explicitly before financial or job-creation effects. Complaints and support review remain available. EUR SMS is suppressed because the existing telephone transport is configured for Romania; no new supplier-email channel is invented.

Renovation work requires a separate assessment before automatic booking. Area/visit rates are not extrapolated into unsupported time or surfaces. No unverified tariff, tax deduction or unknown fee becomes an executable total.

## Release gates that are still open

1. **Commercial evidence:** 75 of 78 cities have at least two own published numeric price sources, but none has fully comparable independent offers covering all selected service/crew scenarios. There are zero approved tariffs and zero active new markets. VAT, products, travel, minima, coverage and validity still require source-specific clarification. The 234 request-for-quote drafts are unsent.
2. **Real suppliers:** local identity, Connect currency/capability, actual coverage and physical team capacity must be verified before a market can accept work.
3. **Email delivery:** this branch does not establish the cause or resolution of the previous LIVE receipt incident. Authorized provider diagnostics, delivery events and receipt evidence remain necessary; tests never sent real mail.
4. **Processor validation:** complete an isolated Stripe sandbox end-to-end release test with authorized sandbox configuration before enabling real EUR work. Simulations do not establish actual settlement or FX fees.
5. **Joint review:** owner/team review and explicit release approval remain mandatory. IP suggests a visitor context; the confirmed service address determines the commercial work market. No claim of new geographic LIVE probes is made by this coding run.

## Flags and deployment

Default `NITIDO_ENABLE_INTERNATIONAL_PRICING` is off. Review is permitted only on an explicitly isolated origin and is rejected with LIVE Stripe credentials. Production new EUR authorization requires both the pricing flag and `NITIDO_INTERNATIONAL_LIVE_APPROVED=true`, plus a valid approved/active tariff and eligible local crew. Capture, cancellation, refund and recovery of existing stored EUR obligations remain possible when new pricing is disabled.

No activation flag or Coolify configuration was changed. No HTTP action can approve/activate a tariff in this candidate. Schema additions retain existing records and do not rewrite historical Romanian pricing. Before any authorized release, take and verify a backup, review additive migrations and rollback of new booking admission, and keep financial obligation recovery available. Do not roll back by deleting financial or quote history.
