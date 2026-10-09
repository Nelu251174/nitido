# NITIDO Pro v1.1 — implementation and release gates

Date: 2026-09-24. Candidate base: `439c9fe9cbba87417568cf7ad3668dd80a87646b` (`codex/mobile-nav-alignment-sandbox`).
Production Git Source was confirmed by owner screenshot on 2026-09-24: fix/windows-area-clear at 9cbc59357c0a6b0aa29e91cdfb8d69c3de97ff35. The production candidate applies only the Pro changes onto that exact base, preserving all 61 production-only commits. Production uses docker-compose.production.yml; the sandbox SHA must not replace production directly. Coolify authentication remains unavailable to the agent.

## Delivered in this branch

- Existing palette, homepage content and visual components preserved. Conditional NITIDO PRO entry follows Login firmă, including mobile menu and footer.
- Public Pro landing (eight sections), two-step client/partner qualification, persisted leads, compatibility redirect for /parteneri-pro.
- Isolated /pro workspace: organizations, properties, work orders, schedule, recurring rules, maintenance tickets, approvals, reports/CSV, team invitations, settings, partner portal and administrative onboarding.
- Shared NITIDO identity, explicit Pro memberships and object scopes. Partner offers redact addresses until acceptance. Closed/cancelled work revokes partner access.
- Transactional, versioned quotes, mandatory approvals above the snapshot threshold, separate approver policy, no admin financial override, single active offer, idempotent commands and final-cost recording.
- Checklist snapshots, protected decoded/re-encoded media, upload limits and hashes, after-photos required, QC/rework, append-only application audit.
- AES-256-GCM access-code storage with property-bound AAD, disabled without a configured key, time-windowed reveal and audited access.
- Manual turnover scheduling and recurring weekly/biweekly/monthly generation with occurrence uniqueness. Failed/missed generation is surfaced to the operator. No Pro automatic payments or marketplace financial hooks.
- In-app notification outbox; opt-in email dispatch reuses the existing provider configuration. No new production dependencies.

## Explicit migration and legacy handling

No production data has been inspected, changed or deleted. Old Git commits remain recoverable.
The candidate branch does not contain legacy Pro concrete routes or the unsafe quote override endpoint. The catch-all rejects `/api/pro/quotes/:id/override`.

1. Confirm Coolify production/sandbox branch, SHA and persistent volume mounts. Confirm the candidate's existing platform features match the deployed base before integration.
2. Inventory existing `pro_*` tables read-only and their row counts; take and restore-test a consistent DB/uploads backup.
3. If there are legacy Pro tables, the migration deliberately FAILS without writing. Map/archive/migrate those records explicitly; do not drop populated tables. A data migration for unseen production legacy data is not claimed complete.
4. For a database without legacy Pro tables, execute the migration against a backed-up copy first:

```bash
NITIDO_PRO_DB_PATH=/absolute/path/to/data/nitido.db node scripts/pro-migrate.mjs
```

The migration is transactional, creates only Pro tables and preserves existing NITIDO users/marketplace/workspace data. It never runs from an HTTP request. Identities are shared; existing marketplace properties/organizations are not silently copied or activated as Pro. Reconciliation of a portfolio already using workspace_* is a release decision, not an automatic duplication/import.

5. Build sandbox with `NEXT_PUBLIC_NITIDO_PRO_PUBLIC=true`; set `NITIDO_PRO_ENABLED=true` at runtime. Without these flags the product entry and APIs stay off. NEXT_PUBLIC flags require a rebuild.
6. Optional `NITIDO_PRO_ACCESS_KEY`: 64 hex characters from a secure key-generation process, stored in the deployment secret manager, never in Git. Missing key disables code storage/reveal. Current format uses key version 1; perform a controlled re-encryption migration before key rotation, do not simply replace the key.
7. Existing `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_SITE_URL` are reused only by the runner. No emails were sent during verification. Existing `CRON_SECRET` secures `/api/pro/cron`; schedule `scripts/pro-runner.mjs` every 15 minutes with `NITIDO_PRO_RUNNER_URL` configured. Failed jobs must be monitored. Provider acceptance is not delivery/read confirmation; delivery webhooks and push/SMS Pro are not included in this candidate.
8. Store `data/pro-uploads` on a private persistent volume, alongside coherent DB backups. Do not mount it under public/. Apply a reverse-proxy request body limit of 9 MiB on Pro uploads. Current SQLite design requires a compatible single-writer deployment, not independent local DBs per replica.
9. Use an existing admin MFA session at `/pro/operator` to create an organization from a known Owner user ID and contract reference, add properties, activate the organization and verified partner accounts. Pilot defaults require a separate approver; invite one from the Owner's team screen. Demo data must never be seeded into production.

## Verification actually executed

- Production build with both Pro flags enabled: PASS.
- TypeScript type check: PASS at the checked revision.
- Targeted Pro integration/API tests: 26 passing on the final candidate; rerun exact paths after changes:

```bash
npx vitest run src/lib/pro/core.test.ts src/app/api/pro/route.test.ts
```

Tests cover SQLite transactions, tenants, scope, approval snapshot/version, self/admin approval denial, acceptance/redaction/revocation, expiry, mandatory checklist/photos/QC, cost limit, replay, stale versions, audit rollback, recurrence replay, encryption/window, CSV injection, HTTP auth/origin/IDOR, legacy preservation, invitation token non-persistence/revocation, archive guards and rescheduling concurrency.

- Existing full suite on candidate (before API tests): 948 passed, 156 failed in 14 files.
- Exact untouched base: 933 passed, the same 156 failed in the same 14 files. The 15 added core tests account for the increase. Existing failures include schema-fixture mismatches (`rooms`) and AI-response expectations. This is not a green full regression gate.
- Browser rendering/responsive review: NOT completed. Cloud browser rejected localhost, and the deployment panel was unavailable. Do not claim approved visual parity from compilation.
- Authenticated production E2E, production migration, backup restore and real device notifications: NOT performed.

## Remaining acceptance work / known pilot limits

This is a reviewable implementation candidate, not a certified full P0 release. Before activation:

- Complete browser/keyboard/360–1440px review and end-to-end sandbox journeys for all three roles.
- Confirm deploy base; resolve or explicitly assess existing regression failures, inspect real data and complete any legacy/workspace portfolio migration.
- Finish financial adjustments/reconciliation beyond external invoice references, fuller recurring-rule editing, configurable service catalog, reminders/escalation ownership and fine-grained notification preferences. Property editing/archive, report period/property/category filters, unscheduled occurrence skip, work rescheduling and partner suspension are implemented.
- Invitation creation returns a link for authorized delivery; it does not send an unsolicited email. Owners should share through their approved channel. Member and invitation revocation are implemented; owner transfer requires a controlled follow-up.
- Calendar is a chronological operations list with recurring controls, not a full drag-and-drop calendar. Report reads/exports are bounded to 1,000 recent entries and make that limit visible; work/property lists are bounded to 500.
- No storage/retention job deletes records automatically. Approve legal retention periods before adding a purge job. No pricing, payment settlement, 24/7 intervention or legal compliance promise is introduced.
- Partner replacement after an execution starts requires a new linked intervention; do not rewrite historical assignment. P0 checklist exceptions are currently stricter than the brief: all required items/photos must be present.
- Validate commercial terms, service coverage, operator staffing, provider setup and emergency handling before accepting paying pilot portfolios.

## Rollback

Disable both feature flags (rebuild for the public flag) and return to the previously confirmed application image. Preserve all Pro tables and private files for investigation and forward repair. Do not use a rollback that drops new data. Migration refusal on legacy data is intentional and must not be bypassed with destructive SQL.

## Docker packaging verification

The Docker builder accepts NEXT_PUBLIC_NITIDO_PRO_PUBLIC as a build argument (default false).
The final image includes pro-migrate.mjs, pro-runner.mjs and a compiled schema.mjs,
so migration does not depend on TypeScript source execution or dev dependencies.
Local verification exercised the compiled-schema CLI against a temporary database twice.
A Docker engine is unavailable in the authoring environment; a real image build remains a sandbox gate.
Keep NITIDO_PRO_ENABLED=false until the explicit migration succeeds on the backed-up sandbox DB.
Existing private marketplace photographs use /app/data/uploads; new Pro photographs use
/app/data/pro-uploads. The public uploads volume may therefore be empty. Archive contents
and restoration must be verified separately from Coolify's Success status.

## Production integration — 2026-09-24

- Branch: feat/nitido-pro-production-v11, based on the confirmed live Git Source SHA above.
- Retains production Compose volume names, Stripe environment, public URL, SEO, pricing, booking and mobile corrections.
- Compose forwards NEXT_PUBLIC_NITIDO_PRO_PUBLIC to the Docker build and NITIDO_PRO_ENABLED to runtime, both default false. Keep both disabled for the initial installation until a consistent production backup and migration are verified, then enable and rebuild.
- The owner approved the cream Pro header, green/gold Pro button and Inter form heading in sandbox. These exact styles are retained.
- Production backup, migration, deployment and authenticated E2E are still pending. Sandbox backups do not cover production volumes.

Production integration verification: production build with Pro enabled PASS; 64 tests PASS across Pro core/API, windowsPricing, pricing, pricingSnapshot and bookingAddress. CSS syntax and staged whitespace checks PASS. No production database or deployment was modified by these checks. Docker image build was not executed locally.
