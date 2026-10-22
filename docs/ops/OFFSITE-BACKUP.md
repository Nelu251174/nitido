# Encrypted off-host backups

The application database and uploads are copied to a dedicated authenticated Restic REST receiver on a separate existing server. The receiver must prove a different Linux kernel boot identity before a source uploads anything. HTTPS certificate validation, scoped transport credentials, a separate encryption password and a pinned repository ID are mandatory. Backup is disabled unless `NITIDO_OFFSITE_BACKUP_ENABLED=true`.

## Contents and boundaries

- SQLite online snapshot, including committed WAL state; integrity, foreign keys, schema and per-table counts checked on the restored copy.
- `public/uploads`, `data/uploads`, `data/pro-uploads`; byte hashes and exact inventories checked before/after copying and after restoration.
- Each run restores its new encrypted snapshot into an isolated private directory, verifies it, then removes temporary plaintext files. It never restores over the live database or writes business records.
- Application environment secrets, infrastructure configuration, source history and native store credentials are **not** in this archive. Keep the application's existing recovery secrets separately; encrypted Pro fields require their original application encryption keys.
- Separate live/sandbox repositories and credentials. Receiver stores only transport password hashes, not repository decryption passwords. No database files or manifests are sent to application logs.
- Thirty daily restore points plus the last three snapshots; only a repository exclusively matching the expected host, path and tag may be pruned. This is not immutable/WORM storage: a compromised writer can delete its repository. First and weekly full encrypted-data checks supplement per-run checks and restore verification.

## Deployment

1. Deploy `ops/backup-receiver/receiver.mjs` with pinned rest-server 0.14.0 behind the existing HTTPS proxy, isolated `/data` persistent volume, 256 MiB memory and 0.5 CPU limits. Require bcrypt cost 10–14 transport hashes and a separate 64-hex health token. Every secret in Coolify uses locked (`is_shown_once=true`), runtime-only variables.
2. Allow 2 GiB per repository, with at least two quotas plus 2 GiB available before receiver startup. A run refuses a receiver with less than 2 GiB free. Confirm actual disk use as data grows; quota exhaustion must fail safely.
3. Deploy client tooling with backups disabled. Configure a scoped HTTPS REST URL, `RESTIC_REST_USERNAME`, `RESTIC_REST_PASSWORD`, `RESTIC_PASSWORD` and `NITIDO_BACKUP_HEALTH_TOKEN` through secret configuration, never Git or command arguments.
4. Execute the explicit CLI `node scripts/offsite-backup-admin.mjs preflight`, then `init` **once on an empty dedicated repository**. Pin the reported nonsecret repository ID as `NITIDO_OFFSITE_REPOSITORY_ID`. The automatic runner never creates or guesses repositories.
5. Enable and run sandbox first, then live. Inspect `node scripts/offsite-backup-admin.mjs status`: require `passed`, `encrypted`, `receiverVerified`, `restoreVerified` and a fresh success timestamp. Perform HTTP/product checks after deployment.
6. Schedule `node scripts/offsite-backup-runner.mjs` daily, timeout 21600 seconds. Use a different start time for each scope. Cron timezone must be recorded from the deployed scheduler, not assumed.

The runner uses kernel `flock`; overlapping runs skip and process exit releases the lock. Nonzero exits are actionable failures, never successful backups. The operator must monitor the scheduler execution status and the age of `lastSuccessfulAt`; there is no claim of email/push delivery without a separately verified notification channel.

## Recovery drill

On an isolated trusted recovery machine, use the owner-held recovery credentials, pinned Restic binary and recorded repository ID. Read `cat config`, `snapshots`, `check --read-data`, and restore a specific snapshot into a new private directory. Validate its manifest, database integrity and every upload hash with `verifyRestored` before considering a maintenance-window switch. Preserve original application encryption keys and version/configuration compatibility. A drill inside the source container proves retrieval and integrity; it does not prove a replacement production stack can boot without the separately held application secrets.

## Rollback

Disable only the new backup scheduled task and set the new backup flag false. Existing reservations, Stripe, commissions, prices and notification runners are unaffected. Keep the receiver volume and encryption keys for recovery. To revert client packaging, pin the previously verified application commit; never delete the receiver volume or snapshots as part of rollback.
