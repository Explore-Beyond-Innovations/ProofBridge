# @proofbridge/auto-merchant-bot

Headless service that signs in as the testnet admin wallets
(`0x2E5E...38BB` on Sepolia, `GC2N...DWK` on Stellar testnet), polls the
backend for incoming `ACTIVE` bridge orders against ads those wallets own,
and auto-locks them on-chain. Removes the "no merchant answered" dead end
from the bridger UX during demos / testnet play.

## What it does (per poll tick)

1. Lists `ACTIVE` trades where the bot's linked wallets are the ad creator.
2. For each new one not already in flight:
   - `POST /v1/trades/:id/lock` → backend returns `{ signature, authToken,
     timeToExpire, orderParams, contractAddress, chainKind }`.
   - Submits `lockForOrder` (EVM) or `lock_for_order` (Soroban) on-chain
     using the admin key that matches the ad's chain kind.
   - `POST /v1/trades/:id/confirm` with the on-chain txHash.
3. Repeats.

One in-flight lock per chain; chains run in parallel; dedup by trade id.

## Setup

```bash
cp apps/auto-merchant-bot/.env.example apps/auto-merchant-bot/.env
$EDITOR apps/auto-merchant-bot/.env     # fill in admin keys + RPC URLs
pnpm install
pnpm --filter @proofbridge/auto-merchant-bot start
```

First run ships with `DRY_RUN=1` — the bot logs "would lock <tradeId>"
but skips the chain submission + `/confirm`. Flip to `DRY_RUN=0` once
you've watched one iteration log cleanly.

## Bootstrap sequence at startup

1. EVM challenge + SIWE sign + `/auth/login` → receives JWT for the EVM
   admin wallet's user row.
2. Stellar challenge + SEP-10 co-sign + `/auth/link` → attaches the
   Stellar admin wallet to that same user.

After step 2, a single JWT covers both chains. Lock endpoint's wallet
match check resolves per chain via `users.getWalletForChain`.

## Safety

- Polls only — no DB access, no chain listener.
- Env-only secrets. Never reads filesystem keys.
- Fails loud: any 4xx / 5xx / chain error gets structured-logged and the
  trade is dropped from the in-flight set so the next tick can retry.
- Per-chain serialization: one lock at a time per chain (so the admin's
  nonce stays sane on EVM, the sequence stays fresh on Stellar).

## Deploy

This is a standalone service. Build the Docker image:

```bash
docker build -f apps/auto-merchant-bot/Dockerfile -t proofbridge/auto-merchant-bot .
docker run --env-file apps/auto-merchant-bot/.env proofbridge/auto-merchant-bot
```

Requires the backend to be reachable from wherever the container runs.
