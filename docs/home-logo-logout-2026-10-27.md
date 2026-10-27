# Homepage branding and reliable sign-out

The NITIDO logo in client and firm workspaces opens the public homepage (`/`). Other workspace destinations remain in the navigation menu. Existing ADMIN workspace navigation retains its existing destination.

Sign-out first requires confirmation that this device's server-side push registration is revoked, then confirmation that the current server session is deleted. OS unregister/delivered-notification cleanup runs only after those confirmations, is best effort, and has a 1.5-second deadline. A rejected or stalled OS method cannot leave the account logged in. A failed server revocation still retains the session/token for a safe retry. Network requests have a 10-second timeout and repeated clicks share a single operation.

Client and firm buttons display progress, disable repeated clicks, and show errors beside the actual button. Confirmed logout uses a full replacement navigation to the login page, clearing the old client-side account view.

Validation uses synthetic users and device tokens, an isolated SQLite database, and the actual production standalone build in an offline browser. No real account is logged out, no notification/email is sent, and native method failures are simulated rather than claimed as physical-device tests. A private SQLite/upload checkpoint with isolated restore is required before LIVE publication. The shared Marketing sandbox is preserved.

Validation and deployment receipts are recorded in `docs/evidence/home-logo-logout-20261027.json`.

LIVE publication completed on 27 October 2026 at 08:52:33 UTC: `5d31a1bec7f1b1b4f318cac7739741e1eeb70e22`, deployment `v3mez2sahwwdlcgoji2id5ut`, running healthy. The private release checkpoint and isolated restore passed; its temporary task was removed. The final regression suite passed 2,629 tests with one existing external-network smoke test skipped. All 26 focused tests, 51 offline production browser checks and 34 LIVE public-page/asset checks passed. Native OS failures and hangs were simulated; no physical-device acceptance is claimed. No real user was signed out during verification.
