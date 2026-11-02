# Confirmation email diagnosis

The LIVE delivery cause is still unconfirmed. This change provides evidence for a future diagnosis; an isolated passing test is not proof of Gmail reception.

## Recorded evidence

`sendEmailResult` classifies configuration, site URL, verification issuance, provider HTTP response and transport failures. It records an opaque correlation ID, a UUID provider message ID when present, HTTP status, category and attempt count. It never records recipients, message payloads, confirmation tokens or hashes, credential values, provider error bodies or exception messages.

`sendEmail` retains its boolean contract: true means the provider returned a successful HTTP response. Its existing callers do not acquire automatic retries. Verification sends may retry one429/5xx response with the same idempotency key, within one shared eight-second timeout. Long Retry-After values are reported without sleeping through them. Accepted responses with a missing or malformed receipt ID remain accepted and are not retried.

The verification diagnostic table retains at most2000 records for30days. Failure to write diagnostics must not fail signup or change provider acceptance. `/api/admin/email-diagnostics` allows only a current Super Admin session and sends `Cache-Control: private, no-store`. It returns bounded technical data and aggregates, without account IDs or recipient details.

## Read-only script

Run synthetic fixture inspection without external transport:

```sh
node scripts/email-diagnostics-readonly.mjs --fixture sanitized-fixture.json
```

When an authorized operator has the deployed runtime and the relevant opaque account ID, existing database metadata can be inspected read-only:

```sh
node scripts/email-diagnostics-readonly.mjs --database /app/data/nitido.db --user-id OPAQUE_ACCOUNT_ID
```

Optional `--provider-domains` performs one fixed GET to the provider domains API using the configured runtime credential. It does not fetch email bodies, send messages, create tasks or alter provider settings. A send-only credential may legitimately refuse this read;401/403 does not establish that sending is broken. Preserve the authorized proxy and TLS trust when running it. Fixture mode refuses this option.

Optional `--provider-events` lists existing email metadata with at most three GET requests and filters only UUID message IDs already linked to the selected account's diagnostic records. It never requests an individual email body. Only whitelisted event names, UUID IDs and timestamps are emitted; other recipients, subjects and response fields are discarded. A bounded search that stops before finding all IDs is labelled truncated. A provider-reported `delivered` event is still not proof that the user saw the message in Gmail. Fixture mode also refuses this network option.

## Acceptance and limits

- `accepted` is provider HTTP acceptance. It is not delivery, inbox placement, a clicked link or a confirmed account.
- A configured transport means required variables exist; it does not establish credential validity or verified sender status.
- The signup screen preserves a created account when transport is unavailable. Resend success is shown only after an explicit `accepted:true`; the banner says "if you received the email".
- Removed accounts cannot issue or consume verification tokens; a new account never inherits the removed identity's confirmation.
- Provider-receipt data, an external delivery event and actual inbox reception require separate current evidence. No real email is sent by the QA suite or this read-only script.

Tests run with synthetic values and Docker `--network=none`. The four Node script tests and the email/auth/UI Vitest set do not verify an installed iPhone/Android package, physical push reception or actual bank settlement.
