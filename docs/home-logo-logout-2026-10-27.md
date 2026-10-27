# Homepage branding and reliable sign-out

The NITIDO logo in client and firm workspaces opens the public homepage (`/`). Other workspace destinations remain in the navigation menu. Existing ADMIN workspace navigation retains its existing destination.

Sign-out first requires confirmation that this device's server-side push registration is revoked, then confirmation that the current server session is deleted. OS unregister/delivered-notification cleanup runs only after those confirmations, is best effort, and has a 1.5-second deadline. A rejected or stalled OS method cannot leave the account logged in. A failed server revocation still retains the session/token for a safe retry. Network requests have a 10-second timeout and repeated clicks share a single operation.

Client and firm buttons display progress, disable repeated clicks, and show errors beside the actual button. Confirmed logout uses a full replacement navigation to the login page, clearing the old client-side account view.

Validation uses synthetic users and device tokens, an isolated SQLite database, and the actual production standalone build in an offline browser. No real account is logged out, no notification/email is sent, and native method failures are simulated rather than claimed as physical-device tests. A private SQLite/upload checkpoint with isolated restore is required before LIVE publication. The shared Marketing sandbox is preserved.

Validation and deployment receipts are recorded in `docs/evidence/home-logo-logout-20261027.json`.
