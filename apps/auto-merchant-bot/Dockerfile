FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/auto-merchant-bot/package.json apps/auto-merchant-bot/
RUN pnpm install --filter @proofbridge/auto-merchant-bot... --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/auto-merchant-bot/node_modules ./apps/auto-merchant-bot/node_modules
COPY apps/auto-merchant-bot ./apps/auto-merchant-bot
RUN cd apps/auto-merchant-bot && pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/auto-merchant-bot/node_modules ./apps/auto-merchant-bot/node_modules
COPY --from=builder /app/apps/auto-merchant-bot/dist ./apps/auto-merchant-bot/dist
COPY apps/auto-merchant-bot/package.json ./apps/auto-merchant-bot/
WORKDIR /app/apps/auto-merchant-bot
CMD ["node", "dist/bin/cli.js"]
