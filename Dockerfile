# Dockerfile pentru Nitido — construit pentru deploy pe Coolify (sau orice host Docker).
# Multi-stage: dependențe -> build -> imagine finală slabă (output: "standalone").

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# python3/make/g++ — necesare pentru compilarea nativă a better-sqlite3 dacă nu
# există binar precompilat pentru platforma imaginii (arm64/amd64).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts/patch-geoip-updater.mjs ./scripts/patch-geoip-updater.mjs
# Managed build proxies can supply their CA as a temporary BuildKit secret.
# A regular Coolify build does not require this secret; TLS remains enabled.
RUN --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then \
    NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --strict-ssl=true; \
  else \
    npm ci --strict-ssl=true; \
  fi

# Pinned, checksum-verified backup utility. Only the binary and flock reach the runtime image.
FROM node:22-bookworm-slim AS backup-tools
ARG TARGETARCH
RUN --mount=type=secret,id=proxy_ca \
  set -eu; \
  apt-get update; \
  apt-get install -y --no-install-recommends curl bzip2 ca-certificates util-linux; \
  rm -rf /var/lib/apt/lists/*; \
  backup_arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
  case "$backup_arch" in \
    amd64) backup_sha=f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c ;; \
    arm64) backup_sha=a5f64aaab53d51e311fa3829124c5b703f2d14cf187d8640b6be3b2b49376465 ;; \
    *) exit 1 ;; \
  esac; \
  if [ -f /run/secrets/proxy_ca ]; then export CURL_CA_BUNDLE=/run/secrets/proxy_ca; fi; \
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 \
    "https://github.com/restic/restic/releases/download/v0.19.1/restic_0.19.1_linux_${backup_arch}.bz2" \
    --output /tmp/restic.bz2; \
  printf '%s  /tmp/restic.bz2\n' "$backup_sha" | sha256sum --check --strict; \
  bzip2 --decompress /tmp/restic.bz2; \
  install -m 0755 /tmp/restic /usr/local/bin/restic; \
  rm /tmp/restic; \
  restic version

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Public values are compiled by Next.js; production must receive its own values.
# Secret keys must never be passed as build arguments.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_NITIDO_PRO_PUBLIC=false
ENV NEXT_PUBLIC_NITIDO_PRO_PUBLIC=$NEXT_PUBLIC_NITIDO_PRO_PUBLIC
RUN npm run build
RUN node scripts/pro-build-migration.mjs

FROM node:22-bookworm-slim AS runner
WORKDIR /app
COPY --from=backup-tools /usr/local/bin/restic /usr/local/bin/restic
COPY --from=backup-tools /usr/bin/flock /usr/local/bin/flock
COPY --from=backup-tools /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Output standalone: server minimal + node_modules necesare, fără sursă/devDependencies.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/authorization-coverage-runner.mjs ./scripts/authorization-coverage-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/express60-runner.mjs ./scripts/express60-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/recurring-runner.mjs ./scripts/recurring-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/financial-recovery-runner.mjs ./scripts/financial-recovery-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/notification-recovery-runner.mjs ./scripts/notification-recovery-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/appointment-reminders-runner.mjs ./scripts/appointment-reminders-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/availability-alerts-runner.mjs ./scripts/availability-alerts-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/owner-notifications-runner.mjs ./scripts/owner-notifications-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/store-download-report-runner.mjs ./scripts/store-download-report-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/store-download-reports.mjs ./scripts/store-download-reports.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/offsite-backup.mjs ./scripts/offsite-backup.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/offsite-backup-runner.mjs ./scripts/offsite-backup-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/offsite-backup-admin.mjs ./scripts/offsite-backup-admin.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/healthcheck.mjs ./scripts/healthcheck.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/marketing-city-start.cjs ./scripts/marketing-city-start.cjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/verify-database-backup.mjs ./scripts/verify-database-backup.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/recovery.mjs ./scripts/recovery.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/release-preparation.mjs ./scripts/release-preparation.mjs

COPY --from=builder --chown=nextjs:nodejs /app/scripts/pro-migrate.mjs ./scripts/pro-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/pro-runner.mjs ./scripts/pro-runner.mjs
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/pro/schema.mjs ./src/lib/pro/schema.mjs

# Directoare persistente — legate ca volume în docker-compose.yml, ca baza de
# date SQLite și pozele încărcate să supraviețuiască la redeploy.
RUN mkdir -p /app/data /app/public/uploads && chown -R nextjs:nodejs /app/data /app/public/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
