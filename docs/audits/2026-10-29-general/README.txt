General verification, 29 October 2026

Code fixes: use verified-review eligibility in offer stars and quality ranking; visibly mark and disable synthetic mobile design previews; update qs to 6.17.1; add scoped HTTP security headers.

Evidence distinctions: public LIVE HTTP reads are anonymous and read-only. The production browser/HTTP scenario uses a fresh synthetic SQLite database with all service credentials disabled and Docker networking disabled. Unit/integration provider responses are mocked. None of these results certify every physical device or successful external delivery.

Reproduction: compile with Node 22 and the lockfile; run vitest run and npm run build. browser.cjs requires the compiled standalone server under /app/runtime, tracked public assets and .next/static, playwright-core under /qa-tools, bcryptjs under /qa-bcrypt, Chromium, and evidence/fx-fixture.cjs. It deletes ONLY /app/runtime/data, creates synthetic users/jobs, and must run in a disposable isolated runtime, never a live application directory. No production environment file or credentials should be supplied.

Important outstanding limits: account deletion is explicit request intake/review, not erasure; general push/SMS recovery is sandbox-gated; LIVE phone delivery and mailbox receipt were not physically retested; scheduled backup configuration is not a fresh recovery proof. Existing Marketing city campaigns and real financial records were not changed.
