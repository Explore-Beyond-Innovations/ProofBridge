#!/usr/bin/env bash
set -euo pipefail

# One-shot deploy + migrate + seed for the docker-local stack.
#
# Expects these env vars from docker-compose:
#   EVM_RPC_URL, STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE,
#   STELLAR_NETWORK, STELLAR_SOURCE_ACCOUNT, EVM_ADMIN_PRIVATE_KEY,
#   DATABASE_URL, ROOT_DIR.
#
# On success, writes:
#   /shared/deployed.json        — contract addresses for the seed step
#   /shared/stellar-admin.secret — secret key consumed by the relayer

SHARED_DIR="${SHARED_DIR:-/shared}"
SNAPSHOT_PATH="$SHARED_DIR/deployed.json"
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
# Slim deployer image has no `cast` — talk to anvil via raw JSON-RPC.
# Compose already gates us on `anvil: service_healthy`, so this is a
# sanity check more than a real wait loop.
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

log "friendbot-funding '$ADMIN_ACCT'…"
for i in $(seq 1 30); do
  if stellar keys fund "$ADMIN_ACCT" --network "$STELLAR_NETWORK" 2>/dev/null; then
    break
  fi
  log "  friendbot not ready (try $i/30)…"
  sleep 4
  [[ $i -eq 30 ]] && { log "friendbot funding failed"; exit 1; }
done

ADMIN_SECRET="$(stellar keys show "$ADMIN_ACCT")"
printf '%s' "$ADMIN_SECRET" > "$ADMIN_SECRET_PATH"
log "wrote admin secret → $ADMIN_SECRET_PATH"

# ── deploy contracts ─────────────────────────────────────────────────
#
# WASMs, EVM artifacts, and the deposit VK are bind-mounted in from
# $ROOT_DIR (populated by up.sh from the Proofbridge-Contracts `latest` GitHub Release,
# or from the repo's locally-built tree via `up.sh --local`). Sanity-check
# their presence before running deploy so missing artifacts fail fast.

for wasm in verifier merkle_manager ad_manager order_portal; do
  path="$ROOT_DIR/contracts/stellar/target/wasm32v1-none/release/${wasm}.wasm"
  [[ -f "$path" ]] || { log "missing stellar wasm: $path"; exit 1; }
done
[[ -d "$ROOT_DIR/contracts/evm/out/OrderPortal.sol" ]] \
  || { log "missing EVM artifacts under $ROOT_DIR/contracts/evm/out"; exit 1; }
[[ -f "$ROOT_DIR/proof_circuits/deposits/target/vk" ]] \
  || { log "missing deposit VK at $ROOT_DIR/proof_circuits/deposits/target/vk"; exit 1; }

log "deploying contracts…"
cd "$ROOT_DIR/scripts/relayer-e2e"
ROOT_DIR="$ROOT_DIR" \
STELLAR_SOURCE_ACCOUNT="$ADMIN_ACCT" \
EVM_RPC_URL="$EVM_RPC_URL" \
EVM_ADMIN_PRIVATE_KEY="$EVM_ADMIN_PRIVATE_KEY" \
  pnpm exec tsx cli.ts deploy --out "$SNAPSHOT_PATH"

# ── db migrations + seed ─────────────────────────────────────────────

log "running prisma migrations…"
cd "$ROOT_DIR/apps/backend-relayer"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

log "seeding database…"
cd "$ROOT_DIR/scripts/relayer-e2e"
DATABASE_URL="$DATABASE_URL" pnpm exec tsx cli.ts seed --in "$SNAPSHOT_PATH"

# ── optional: fund frontend dev wallets ──────────────────────────────

if [[ -n "${DEV_EVM_ADDRESS:-}" || -n "${DEV_STELLAR_ADDRESS:-}" ]]; then
  log "funding dev wallets (evm=${DEV_EVM_ADDRESS:-<unset>} stellar=${DEV_STELLAR_ADDRESS:-<unset>})…"
  ROOT_DIR="$ROOT_DIR" \
  EVM_RPC_URL="$EVM_RPC_URL" \
  STELLAR_RPC_URL="$STELLAR_RPC_URL" \
  EVM_ADMIN_PRIVATE_KEY="$EVM_ADMIN_PRIVATE_KEY" \
  DEV_EVM_ADDRESS="${DEV_EVM_ADDRESS:-}" \
  DEV_STELLAR_ADDRESS="${DEV_STELLAR_ADDRESS:-}" \
    pnpm exec tsx cli.ts fund --in "$SNAPSHOT_PATH"
fi

log "done ✓"
