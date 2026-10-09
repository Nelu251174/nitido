# NITIDO PR85 full-suite A0 stabilization

Exact baseline: git archive 4c831514 into /tmp/nitido-baseline with shared installed node_modules, TZ=UTC.

Baseline: 1510/1592 passing, 82 failing, plus push.test.ts import error (tests not collected).

| File | Baseline collected | Baseline failed | Targeted after | Cause |
|---|---:|---:|---:|---|
| src/lib/allocationConcurrency.test.ts | 41 | 37 | 43/43 | Missing production migrations masked SQL; revealed negative timing normalized by team max (runtime corrected, +2 regression cases). |
| src/lib/business.test.ts | 5 | 2 | 5/5 | Workspace migrations absent. |
| src/lib/notifications.test.ts | 8 | 1 | 8/8 | Assisted operation tables absent. |
| src/lib/propertyImport.test.ts | 6 | 4 | 6/6 | Post-workspace schema columns absent. |
| src/lib/push.test.ts | 0 | 0 | 9/9 | Real import cycle workspace/proof/db; root ids leaf breaks cycle. Migration fixture still retains legacy SCHEMA_SQL. |
| src/lib/selectionRecovery.test.ts | 29 | 29 | 29/29 | Missing production migration tables prevented offers/authorization fixture. |
| src/lib/siteContent.test.ts | 9 | 4 | 9/9 | Confirmed editorial update f79a8fa and support guide/chat contract changed; tests assert current meaningful disclosures. |
| src/lib/stripePayments.test.ts | 9 | 1 | 9/9 | Legacy calcGrossPrice reference replaced by current server calcServicePrice + acceptedBookingQuote; no financial runtime edits. |
| src/app/incredere/trustPage.test.ts | 2 | 1 | 2/2 | Confirmed editorial headings changed; all eight trust pillars remain asserted. |
| src/app/api/support/ai/route.test.ts | 5 | 3 | 5/5 | Support route exposes guide availability separate from AI; fallback source=guide with zero network/context, AI source=ai. (+1 canonical question no-AI-context regression). |

Existing assertions were not removed/skipped. Source expectations were changed only against confirmed current implementations. Existing financial logic was retained.

Targeted evidence: /tmp/nitido-qa/fixes-utc.json, fixes-bucharest.json (125/125 per timezone); support-canonical-utc.json (6/6 including one added test).

Full final Europe/Bucharest: 1661/1661 across 151 files, zero failures and zero pending/skipped. Compared with exact baseline: 82 existing failures corrected, 9 existing push tests restored from the import error, 60 new tests added across the team. Final full UTC: 1661/1661 across 151 files, zero failures and zero pending/skipped. Final full Europe/Bucharest also includes all nine provider-score tests. JSON and logs: final-utc.json/log and final-bucharest.json/log. No pending/skipped tests. Initial full UTC was invalidated by an agent runtime+test edit while running, retained as inprogress-utc.json. No authenticated browser/device/sandbox/live payment validation is claimed.
