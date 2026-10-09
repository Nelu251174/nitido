# NITIDO upgrade — A0 validation package

Baseline: `8a776e23e865fb4cba2725270e12449fd7c45605`.
Branch: `fix/nitido-upgrade-a0-validation`.

## Changes and cause

The audited selection originally had 119 passes and 67 failures (186 tests).
The fixtures used only SCHEMA_SQL, while production also applied workspace, visit-care,
capacity and recurring migrations. Exporting initializeDatabase reuses the existing
initialization statements, in their original order, for isolated in-memory databases.
The production singleton calls that same function; no new migration or pricing rule is introduced.

The recurrence tests were also stale: generation now creates Standard visits for client
selection across a configurable horizon, without automatically assigning or charging.
Preference requires a completed booking with that client. Tests now seed that history,
verify rejection without history, control the clock, and use explicit Bucharest offsets.
Single-occurrence cases explicitly select a one-day horizon; a separate default 30-day
case checks all five expected dates, no automatic payment/assignment, and retry safety.
Pause tests advance the scheduler through the paused dates before asserting its cursor.
The team test now cancels the rejected overlapping fixture before testing the adjacent slot;
the existing conservative firm-wide capacity restriction remains intact.

## Evidence

- Original 186 tests now pass; none removed or skipped.
- Four additional tests: two migration/idempotence tests, default horizon and preferred-firm eligibility.
- 59 existing payment confirmation/recovery tests additionally pass with mocked Stripe.
- Total: 249/249 across 18 files in both TZ=UTC and TZ=Europe/Bucharest.
- `npx next typegen` then `npx tsc --noEmit`: pass.
- `git diff --check`: pass.
- Legacy migration verifies occurrence identity, monthly anchor, historical price immutability,
  foreign keys, repeated initialization, and SQLite integrity.

This is a targeted regression selection, not the full repository test suite.
No live Stripe requests, device tests, sandbox role walkthrough, build, or deployment
were performed for this package. A0 operational validation remains open until the
Standard/Express/Pro sandbox walkthrough is completed. This package is not a production release.

## Reproduce

```bash
npm ci
TZ=UTC npm run test:upgrade:a0
TZ=Europe/Bucharest npm run test:upgrade:a0
npx next typegen
npx tsc --noEmit
```

The upgrade-a0 GitHub workflow runs the same selection and type check in both zones.
It adds a scoped regression gate; it does not replace the existing CI workflow.

| File under src | Tests |
|---|---:|
| lib/acceptJob.test.ts | 5 |
| lib/acceptJobRecovery.test.ts | 13 |
| lib/authorization.test.ts | 5 |
| lib/catalogCapacity.test.ts | 6 |
| lib/databaseInitialization.test.ts | 2 |
| lib/noShow.test.ts | 5 |
| lib/offers.test.ts | 8 |
| lib/paymentConfirmation.test.ts | 59 |
| lib/pricing.test.ts | 22 |
| lib/pricingSnapshot.test.ts | 5 |
| lib/proofOfWork.test.ts | 11 |
| lib/recurring.test.ts | 46 |
| lib/serviceCatalog.test.ts | 4 |
| lib/workspace.test.ts | 25 |
| app/api/proofSecurity.test.ts | 5 |
| lib/pro/core.test.ts | 15 |
| app/api/pro/route.test.ts | 11 |
| app/api/admin/catalog/route.test.ts | 2 |
