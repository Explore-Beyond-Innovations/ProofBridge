# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1 — builder
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

WORKDIR /repo

# Copy workspace manifests first for better cache hits.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/backend-relayer/package.json apps/backend-relayer/
COPY packages/proofbridge_mmr/package.json packages/proofbridge_mmr/

# Prefetch all workspace deps once.
RUN pnpm fetch --ignore-scripts

# Now pull in the sources we need to build.
COPY apps/backend-relayer apps/backend-relayer
COPY packages/proofbridge_mmr packages/proofbridge_mmr

# Install & build the relayer (and only the relayer — avoid compiling every
# workspace package).
RUN pnpm install --frozen-lockfile --offline \
 && pnpm --filter backend-relayer exec prisma generate \
 && pnpm --filter backend-relayer build

# `pnpm deploy` only copies files listed in the package's `files` field, so
# copy dist/ and prisma/ explicitly, then re-run prisma generate inside /out
# so .prisma/client lands in the final node_modules.
RUN pnpm --filter backend-relayer deploy --prod --legacy /out \
 && cp -r apps/backend-relayer/dist /out/dist \
 && cp -r apps/backend-relayer/prisma /out/prisma \
 && cd /out && npx prisma generate --schema=prisma/schema.prisma

# -----------------------------------------------------------------------------
# Stage 2 — runtime
# -----------------------------------------------------------------------------
FROM node:20-slim AS runtime

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out/package.json ./package.json
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/dist ./dist
COPY --from=builder /out/prisma ./prisma

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=2005
EXPOSE 2005

# `tini` keeps signal forwarding sane. Migrations run on every boot — idempotent
# for an already-migrated DB.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
