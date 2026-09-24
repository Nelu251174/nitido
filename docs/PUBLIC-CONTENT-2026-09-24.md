# Public content revision — 24 September 2026

Production base: `59528ff0aa3da6e0d692431d204f479d0de07cf3` on `feat/nitido-pro-production-v11`.

## Scope

Expanded the destinations of every link in the four footer groups: product, clients, company and legal. Booking remains the existing configurator. Added practical descriptions, preparation steps, Standard/Express selection differences, payment-state explanations, incident guidance and clearer action labels. Public Pro now explains each feature, activation stage, audience and pilot limitation. Its shared application form explains what submission does and does not activate.

Retained the existing palette, green/gold Pro button and approved form typography. Added a native, keyboard-operable collapsible contents list for long information pages. About now uses the shared header/footer. Footer booking goes to the configurator instead of forcing signup. Phone/email are actionable links. Support answers and chat preserve paragraph breaks. Store badges without configured URLs are explicitly described as informational.

Prices still use the existing calculator constants. Worked examples are calculated rather than independently hardcoded. No pricing, payment, authentication, migration, volume, deployment or database behavior changed.

## Verified

- Production Next.js build and TypeScript: PASS with public Pro enabled.
- Existing targeted tests: 76 PASS across pricing, price snapshots, support knowledge and public navigation.
- Local production server, with both Pro flags enabled: 18 public/entry pages returned HTTP 200; each rendered exactly one h1.
- 157 unique internal destinations/fragment links extracted from those pages: no failed responses or missing anchor targets. Authentication redirects were followed. This checks destinations, not authenticated transactions.
- Working-tree whitespace check: PASS.

The information pages render roughly 735–983 words including shared navigation/footer; Terms and Privacy render over 2,200 each; the Pro landing renders over 1,500. These are rendered-text counts, not promises of unique prose or minimum word targets.

## Limits and operational follow-up

- Browser-based visual/mobile and click-through verification could not be completed: the cloud browser rejects localhost. Build, rendered HTML and HTTP checks are not substitutes for a real-device visual review.
- No production accounts, reservations, payments, messages or portfolios were created for testing.
- No new migration or environment variable is required for this editorial change. Keep the already-enabled Pro flags and existing production settings.
- Coolify deployment remains a separate action: pin the new commit on the same production branch, Save and Redeploy, then verify the new headings and links on the live site. The agent has no authenticated Coolify session.
- Legal identity is rendered from the existing LEGAL_* configuration. Missing fields remain visibly disclosed rather than replaced with fabricated company details. Exact retention periods and the actual production supplier/transfer register still require operator information. Editorial expansion is not legal certification.

## Sources checked

Functional descriptions were checked against pricing.ts, auth.ts, adminAuth.ts, supportKnowledge.ts, SiteChrome.tsx, the booking route, browser-storage call sites and the existing Pro implementation. Legal wording retains applicable-rights qualifications and does not invent refund deadlines, insurance, staffing guarantees or supplier locations.

Primary legal references consulted:
- https://legislatie.just.ro/Public/DetaliiDocument/56973 — Legea 506/2004, storage/access to terminal information.
- https://www.dataprotection.ro/?lang=ro&page=Transmiterea_plangerilor_catre_ANSPDCP — complaints and data-protection rights.

For rollback, redeploy the previous application commit. This revision introduces no database changes.
