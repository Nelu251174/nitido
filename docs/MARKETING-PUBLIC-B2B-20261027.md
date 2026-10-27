# Manual public B2B campaigns: Constanța and București

The owner requested preparation for manual sending to publicly collected business addresses without recording nonexistent consent. Campaign payloads can explicitly select `audienceMode: public_business`; omitted mode retains the documented-consent policy.

The public-business mode is limited to `CT` and `B`, and to the `business` and `cleaning` categories. It requires both a verified source and a technically verified email. Individual contacts, invalid/unverified addresses, withdrawn contacts and all globally suppressed addresses remain excluded. Selection remains scoped by county, locality and category and deduplicates addresses. Existing consent and review fields are never modified by campaign preparation.

Preview, readiness and queue processing use the campaign policy; the worker rechecks source, technical verification, opt-out and geography before dispatch. Changing the policy invalidates an existing queued campaign snapshot. Legacy consent-based queue fingerprints remain compatible.

The interface identifies public B2B campaigns explicitly. It does not label a public address as consented. Saving/preparing a campaign does not enqueue mail or activate the server delivery flag. The final manual confirmation, provider readiness, quotas, budgets, unsubscribe links and provider suppression handling remain in effect.

No database migration, authentication change or other module change is included. The intended data operation selects only the four existing full-audience drafts for CT/B business/cleaning and must leave contact records and outbox unchanged. Sandbox verification precedes any LIVE change. This implementation does not establish recipient permission or certify compliance with provider terms or applicable law.
