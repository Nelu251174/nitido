# Dockerfile pentru Nitido — construit pentru deploy pe Coolify (sau orice host Docker).
# Multi-stage: dependențe -> build -> imagine finală slabă (output: "standalone").

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# python3/make/g++ — necesare pentru compilarea nativă a better-sqlite3 dacă nu
# există binar precompilat pentru platforma imaginii (arm64/amd64).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Output standalone: server minimal + node_modules necesare, fără sursă/devDependencies.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Directoare persistente — legate ca volume în docker-compose.yml, ca baza de
# date SQLite și pozele încărcate să supraviețuiască la redeploy.
RUN mkdir -p /app/data /app/public/uploads && chown -R nextjs:nodejs /app/data /app/public/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
