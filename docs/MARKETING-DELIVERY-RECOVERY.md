# Marketing delivery recovery

The delivery worker has its own serial timer, independent from collection network waits. The admin `process` action wakes that timer and returns immediately; it does not hold an HTTP request open during provider calls. A processed batch schedules another tick promptly. Provider deadlines and the persistent database lease still serialize real delivery.

Explicit Resend HTTP429 responses retain the message as pending and persist the documented reason. Short rate limits respect Retry-After; daily quota waits until the next UTC midnight; monthly quota and authentication failures hold until manual provider review. The first such failure stops that batch. Unknown acceptance is quarantined, never automatically retried. Three consecutive uncertain responses stop further provider attempts until manual review. Historical unknowns remain unchanged, visibly marked as lacking recorded diagnostic evidence.

A new dispatch table persists the exact per-job request, including its unsubscribe link, before the provider call. Retryable pending messages reuse that payload and the existing idempotency key. Failure records contain only fixed error names and HTTP codes, never raw provider response bodies, credentials or recipient data. Additive tables and an outbox index preserve existing campaigns and messages.

The report uses the shared bounded error presentation for reverse-proxy/non-JSON failures, retains its last successful data and clears a transient error after recovery. Provider holds and per-run failure reasons are shown separately. Test capture, provider acceptance and final delivery remain distinct.

Provider references: https://resend.com/docs/api-reference/errors , https://resend.com/docs/api-reference/rate-limit , https://resend.com/docs/dashboard/emails/idempotency-keys . A provider quota cannot be raised by this application. No provider subscription or account configuration is changed.
