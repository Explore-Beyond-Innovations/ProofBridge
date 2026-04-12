# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1 — builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl libc6-compat

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
RUN pnpm install --frozen-lockfile --offline --ignore-scripts \
 && pnpm --filter backend-relayer exec prisma generate \
 && pnpm --filter backend-relayer build

# Produce a self-contained runtime dir with only the relayer's prod deps.
# `pnpm deploy` only copies files listed in the package's `files` field, so
# the built `dist/` and `prisma/` dirs have to be copied explicitly.
RUN pnpm --filter backend-relayer deploy --prod --legacy /out \
 && cp -r apps/backend-relayer/dist /out/dist \
 && cp -r apps/backend-relayer/prisma /out/prisma

# -----------------------------------------------------------------------------
# Stage 2 — runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl libc6-compat tini

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
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
