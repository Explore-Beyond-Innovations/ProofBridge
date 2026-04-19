#!/usr/bin/env bash
set -euo pipefail

# Docker-local preamble; delegates deploy+link to deploy-contracts.sh --no-fetch
# and DB seed to `apps/backend-relayer pnpm seed:dev`.
#
# Env in (from docker-compose): EVM_RPC_URL, STELLAR_RPC_URL,
#   STELLAR_NETWORK_PASSPHRASE, STELLAR_NETWORK, STELLAR_SOURCE_ACCOUNT,
#   EVM_ADMIN_PRIVATE_KEY, DATABASE_URL, ROOT_DIR.
# Out: /shared/stellar-admin.secret

SHARED_DIR="${SHARED_DIR:-/shared}"
ADMIN_SECRET_PATH="$SHARED_DIR/stellar-admin.secret"
mkdir -p "$SHARED_DIR"

log() { echo "[deployer] $*"; }

# ── wait for chains ──────────────────────────────────────────────────

log "waiting for stellar soroban RPC at $STELLAR_RPC_URL…"
for i in $(seq 1 90); do
  if curl -sf -X POST -H 'Content-Type: application/json' \
       -d '{"jsonrpc":"2.0","method":"getHealth","id":1}' \
       "$STELLAR_RPC_URL" 2>/dev/null | grep -q '"status":"healthy"'; then
    break
  fi
  sleep 2
  [[ $i -eq 90 ]] && { log "stellar RPC never became healthy"; exit 1; }
done
log "stellar RPC healthy."

log "waiting for anvil at $EVM_RPC_URL…"
# Raw JSON-RPC probe (no `cast` in this slim image); mostly a sanity check since compose already gated on service_healthy.
for i in $(seq 1 30); do
  if curl -sf -X POST -H 'Content-Type: application/json' \
       -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
       "$EVM_RPC_URL" 2>/dev/null | grep -q '"result":"0x'; then
    break
  fi
  sleep 2
  [[ $i -eq 30 ]] && { log "anvil never responded"; exit 1; }
done
log "anvil up."

# ── stellar network + keys ───────────────────────────────────────────

log "configuring stellar network profile '$STELLAR_NETWORK'…"
stellar network rm "$STELLAR_NETWORK" >/dev/null 2>&1 || true
stellar network add "$STELLAR_NETWORK" \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE"
stellar network use "$STELLAR_NETWORK"

ADMIN_ACCT="$STELLAR_SOURCE_ACCOUNT"
log "generating stellar identity '$ADMIN_ACCT'…"
stellar keys rm "$ADMIN_ACCT" >/dev/null 2>&1 || true
stellar keys generate "$ADMIN_ACCT" --network "$STELLAR_NETWORK"

# Quickstart flips RPC to "healthy" well before friendbot's HTTP endpoint
# is serving. Probe friendbot directly so we don't burn N failed
# `stellar keys fund` RPC round-trips waiting for it.
FRIENDBOT_URL="${STELLAR_RPC_URL%/soroban/rpc}/friendbot"
log "waiting for friendbot at $FRIENDBOT_URL…"
for i in $(seq 1 90); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$FRIENDBOT_URL" || echo 000)"
  case "$code" in
    2*|4*)
      log "friendbot up (http $code)."
      break
      ;;
  esac
  sleep 2
  [[ $i -eq 90 ]] && { log "friendbot never became reachable (last http=$code)"; exit 1; }
done

log "friendbot-funding '$ADMIN_ACCT'…"
stellar keys fund "$ADMIN_ACCT" --network "$STELLAR_NETWORK"

ADMIN_SECRET="$(stellar keys show "$ADMIN_ACCT")"
printf '%s' "$ADMIN_SECRET" > "$ADMIN_SECRET_PATH"
log "wrote admin secret → $ADMIN_SECRET_PATH"

# ── point the per-chain deploy CLIs at the bind-mounted bundle ───────
# Artifacts were fetched+extracted by `up.sh` and bind-mounted into $ROOT_DIR.
export EVM_OUT_DIR="$ROOT_DIR/contracts/evm/out"
export STELLAR_WASM_DIR="$ROOT_DIR/contracts/stellar/target/wasm32v1-none/release"
export STELLAR_DEPOSIT_VK="$ROOT_DIR/proof_circuits/deposits/target/vk"
export DEPLOY_ENV="${DEPLOY_ENV:-local}"

# ── deploy + link chains + emit seed config ─────────────────────────
# `--with-test-tokens` is safe here because docker-local is dev-only.
# Seed config is written into the shared volume so it survives the cd below.
SEED_CONFIG="$SHARED_DIR/seed.config.yaml"
log "delegating deploy + link to scripts/deploy/deploy-contracts.sh…"
bash "$ROOT_DIR/scripts/deploy/deploy-contracts.sh" \
  --chains evm,stellar \
  --no-fetch \
  --with-test-tokens \
  --fresh \
  --seed-config-out "$SEED_CONFIG"

# ── db migrations + seed ─────────────────────────────────────────────

log "running prisma migrations…"
cd "$ROOT_DIR/apps/backend-relayer"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

log "seeding database…"
# `seed:dev` registers tsconfig-paths so @prisma/* / @libs/* aliases resolve without a build.
DATABASE_URL="$DATABASE_URL" pnpm --silent seed:dev --config "$SEED_CONFIG"

# Shared volume persists across restarts — shred the password file.
rm -f "$SEED_CONFIG"

# Recompute manifest paths for downstream fund step.
EVM_MANIFEST="$(ls -t "$ROOT_DIR"/contracts/evm/deployments/*.json | head -n1)"
STELLAR_MANIFEST="$(ls -t "$ROOT_DIR"/contracts/stellar/deployments/*.json | head -n1)"

# ── optional: fund frontend dev wallets ──────────────────────────────

if [[ -n "${DEV_EVM_ADDRESS:-}" || -n "${DEV_STELLAR_ADDRESS:-}" ]]; then
  log "funding dev wallets (evm=${DEV_EVM_ADDRESS:-<unset>} stellar=${DEV_STELLAR_ADDRESS:-<unset>})…"
  cd "$ROOT_DIR/scripts/relayer-e2e"
  ROOT_DIR="$ROOT_DIR" \
  EVM_RPC_URL="$EVM_RPC_URL" \
  STELLAR_RPC_URL="$STELLAR_RPC_URL" \
  STELLAR_NETWORK="$STELLAR_NETWORK" \
  STELLAR_SOURCE_ACCOUNT="$ADMIN_ACCT" \
  EVM_ADMIN_PRIVATE_KEY="$EVM_ADMIN_PRIVATE_KEY" \
  DEV_EVM_ADDRESS="${DEV_EVM_ADDRESS:-}" \
  DEV_STELLAR_ADDRESS="${DEV_STELLAR_ADDRESS:-}" \
    pnpm exec tsx cli.ts fund \
      --evm-manifest "$EVM_MANIFEST" \
      --stellar-manifest "$STELLAR_MANIFEST"
fi

log "done ✓"
