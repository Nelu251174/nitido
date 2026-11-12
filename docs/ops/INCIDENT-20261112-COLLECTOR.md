# Recurring unavailability: isolate public collection

Base: `65a4dd0db0ceda471a5f875b823ecce1bc233d90`, confirmed by the owner in Coolify.

The public website and common application API alternated between HTTP503,
timeouts and slow HTTP200 responses. An owner runtime screenshot showed an active
county collector with more than 330000 persisted pages and 31–40 second batches.
Those batch durations include asynchronous network waits: they do not establish
the exact cause of every historical outage, an OOM event or a particular database
lock.

## Changes

Production collection previously ran in the web server's Node event loop.
It now runs in one supervised child process, using the same database, existing
persisted collection leases, source deadlines, evidence and eligibility rules.
The existing independent delivery scheduler remains in the web process. No
Marketing enablement, consent, campaign or delivery configuration is changed.

The child receives the public collector configuration and existing proxy/TLS
settings. Payment, email-provider, GitHub and Coolify credentials are not passed
to it. Its V8 heap is limited to 256 MiB; native memory remains outside that limit.
On an unexpected process failure, the supervisor permits one delayed recovery
attempt after 15 seconds, then logs a fixed failure code and stops retrying. It
never falls back to running collection in the HTTP event loop. Parent exit or IPC
disconnect stops the child. This does not create another monitoring task or AI
agent, and does not restart the application container.

Frontier summaries previously copied and parsed every stored page on each step.
They now query pending deadlines and blocked reasons separately and iterate only
rows containing evidence. An additive partial index supports evidence lookup.
Previously collected evidence, source refusals, retry deadlines and job/site
boundaries remain covered by regression tests. No page limit or completeness
claim is introduced.

## Build and rollback

The existing prebuild checks also compile the collector with esbuild. JavaScript
dependencies are bundled; the existing native better-sqlite3 package remains
external. Docker explicitly copies the generated collector artifact into the
runtime image. Development and unit-test scheduling remains in process.

The new index is created through the existing idempotent initialization path.
It is compatible with the old code and can remain in place on rollback. There
are no dropped tables, deleted records, changed columns or volume changes.
The data and upload volume declarations remain untouched.

Before rollout, verify the current deployment/commit, absence of a concurrent
deployment and the existing persistent mounts. Publish the tested revision,
verify Finished plus the actual resulting commit in Coolify, then repeat public
read-only checks. A successful trigger or one HTTP200 is not stable recovery.

## Validation and limits

The full suite passed 3321 tests, with one external smoke test intentionally
skipped. Lint passed. In a synthetic 330000 completed-page fixture, the original
collector step delayed a timer by 339 ms; the final suite measured 29 ms after the
compatible first-start index upgrade. These are local measurements, not LIVE
latency promises.

The actual compiled collector resumed a synthetic 330002-page SQLite frontier
with external requests blocked. During an artificial two-second CPU stall in
that child, five parent HTTP health requests remained under 23 ms. The fixture's
retry deadline and persisted page count were preserved, with database integrity
confirmed. This proves process isolation for that workload; shared SQLite write
contention, native-memory pressure and host resource exhaustion still require
operational observation.

The final production Next.js build and targeted lint passed. Desktop/mobile
browser acceptance covered 72 workspace navigation transitions, without missing
workspace frames, document reloads or JavaScript page errors. A separate smoke
of the actual standalone output passed nine checks: health and collector process
readiness, anonymous and synthetic-client administrative API refusal, client data
isolation, desktop/mobile workspace logo navigation, mobile bottom navigation and
browser logout with server-side session revocation. No provider transports were
enabled. These checks ran on local Node 24.19.0; the Docker image's Node 22 runtime
and physical Android/iPhone devices have not been executed in this environment.

The correction is prepared in PR #187 and is not deployed. Current Coolify API
access returns 401, so the current deployment state, lack of concurrent deploys
and resulting LIVE revision cannot be independently verified. Public checks
continue separately; no successful build or local test is presented as LIVE
recovery. No push/email-receipt, payment-settlement or full historical root-cause
claim is made by these isolated checks.
