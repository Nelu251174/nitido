# Approved bathroom package — 20 October 2026

Owner approval: “OK, mergem cu propunerea ta, urca pe server”.

New automatic bookings include one ordinary bathroom and one kitchen. Each additional bathroom adds 50 RON for sanitary fixtures, bath/shower, taps and mirrors; floors are already covered by the declared area. Additional kitchens, appliance interiors and difficult degreasing require assessment. No automatic kitchen surcharge is introduced.

- Counts are integers 0–20; larger/special jobs require assessment. Zero or one bathroom has no surcharge or discount.
- 60 m² apartment + two bathrooms = 450 + 50 = 500 RON; with 10 m² windows = 580 RON.
- Server computes the total, rejects invalid counts and stale confirmed totals, and records the scope and line items in the immutable pricing snapshot.
- Public configurator, account booking, card-setup draft and new recurring plans carry the count. Provider sees the scope and its existing net payout.
- Existing recurring templates with unknown bathroom counts retain the previous calculation with no invented count or additional charge. Already generated jobs and accepted/manual offers are not repriced.
- Nullable columns on jobs and recurring_plans are additive. Existing rows are not rewritten.
- The 18% commission, staffing responsibility, minimum scheduled duration, Stripe authorization/capture and credit rules remain unchanged. No extra hourly fee is introduced.
- Native Expo source carries the same count and quote invalidation; publishing this server release does not claim an App Store/Play binary update.

## Validation

198 focused server/calculation/recurrence tests passed. Expanded server suite: 1,891 passed; three pre-existing BoardSidebar tests fail because their test render lacks intl context. The separately established siteContent baseline failure is excluded from that run. Outdated duration assertions in touched quote/window tests now reflect the existing 180-minute minimum.

144 mobile logic tests passed using a temporary local TypeScript transform without the unavailable Expo base config; the repository config was restored. Production build and server TypeScript validation passed. Targeted lint still reports three existing React render/effect errors in the client/provider dashboards, outside the added bathroom controls. Public GET-only browser checks cover desktop/mobile totals, edits, invalid counts, URL handoff and pricing copy; no real booking, financial operation or notification is used as a test.

## Backup and rollback

Before publication, manual task b7ihe3d8e3jzdhxblmf0naby successfully created /app/data/release-checkpoints/20261020-before-bathroom-pricing from LIVE 5a4d0c130d8d80544fd34d4696e05249c7bad485. It uses SQLite online backup, stable upload hashes before/after copying, integrity and foreign-key checks, and an isolated restore comparison. This backup is on the persistent application data volume, not an off-host disaster recovery copy.

Pin and redeploy 5a4d0c130d8d80544fd34d4696e05249c7bad485 to roll back code. Additive nullable columns can remain; never overwrite current production data with the checkpoint as a routine code rollback. Preserve new booking snapshots and accepted payments. Database restoration, if actually required, must first pause writes and preserve all changes since the checkpoint for reconciliation.

After deploy: verify exact pinned commit, healthy status, public calculator and price page, then run the read-only protected-booking/payment comparison against release checkpoints. Preserve existing recurring scheduler, Express 60 and authorization coverage runner configuration.
