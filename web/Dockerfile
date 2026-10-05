# ── Stage 1: Install dependencies ───────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./

# Copy Docker env as .env.local for Next.js build-time env
COPY web/.env.docker ./.env.local

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ── Stage 3: Production runner ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy build output first (standalone includes server.js + minimal node_modules)
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static

# Then overwrite node_modules + package.json with full production deps
# (standalone's package.json is minimal and may be incomplete)
COPY --from=deps /app/web/node_modules ./node_modules
COPY --from=deps /app/web/package.json ./

# Copy public assets
COPY --from=builder /app/web/public ./public

# Copy migrate script (for init containers / manual runs)
COPY --from=builder /app/web/migrate.mjs ./
COPY --from=builder /app/web/supabase ./supabase

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
