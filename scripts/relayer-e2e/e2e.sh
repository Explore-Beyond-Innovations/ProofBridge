#!/usr/bin/env bash
set -euo pipefail

# End-to-end driver: start_chains → deploy-contracts → compose up →
# seed → fund → flows → teardown. See phase headers below for details.
#
# Env: SKIP_START_CHAINS=1, SKIP_TEARDOWN=1,
#      STELLAR_CHAIN_ID=1000001, EVM_CHAIN_ID=31337.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELAYER_DIR="$ROOT_DIR/apps/backend-relayer"
E2E_DIR="$ROOT_DIR/scripts/relayer-e2e"

COMPOSE_FILE="$RELAYER_DIR/docker-compose.e2e.yaml"
COMPOSE=(docker compose -f "$COMPOSE_FILE" -p relayer-e2e)

# DB URL used from the host (postgres exposes 5433:5432 in the compose file).
HOST_DATABASE_URL="${HOST_DATABASE_URL:-postgresql://relayer:relayer@localhost:5433/relayer}"

STELLAR_CHAIN_ID_NUM="${STELLAR_CHAIN_ID:-1000001}"
EVM_CHAIN_ID_NUM="${EVM_CHAIN_ID:-31337}"

EVM_MANIFEST="$ROOT_DIR/contracts/evm/deployments/${EVM_CHAIN_ID_NUM}.json"
STELLAR_MANIFEST="$ROOT_DIR/contracts/stellar/deployments/${STELLAR_CHAIN_ID_NUM}.json"
SEED_CONFIG="$E2E_DIR/seed.config.e2e.yaml"

cleanup() {
  local ec=$?
  if [[ "${SKIP_TEARDOWN:-0}" == "1" ]]; then
    echo "[e2e.sh] SKIP_TEARDOWN=1 — leaving services up."
    exit "$ec"
  fi
  echo "[e2e.sh] tearing down…"
  "${COMPOSE[@]}" logs backend-relayer > "$ROOT_DIR/.relayer.log" 2>&1 || true
  "${COMPOSE[@]}" down --remove-orphans --volumes || true
  rm -f "$SEED_CONFIG"
  if [[ "${SKIP_START_CHAINS:-0}" != "1" ]]; then
    bash "$ROOT_DIR/scripts/stop_chains.sh" || true
  fi
  exit "$ec"
}
trap cleanup EXIT INT TERM

# ── 1. chains ─────────────────────────────────────────────────────────
if [[ "${SKIP_START_CHAINS:-0}" != "1" ]]; then
  echo "[e2e.sh] starting chains…"
  bash "$ROOT_DIR/scripts/start_chains.sh"
fi

if [[ -f "$ROOT_DIR/.chains.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.chains.env"
fi

# ── 2. deploy + write seed config ────────────────────────────────────
echo "[e2e.sh] deploying contracts via scripts/deploy/deploy-contracts.sh…"
bash "$ROOT_DIR/scripts/deploy/deploy-contracts.sh" \
  --chains evm,stellar \
  --local \
  --with-test-tokens \
  --fresh \
  --seed-config-out "$SEED_CONFIG"

# ── 3. compose up postgres + relayer ──────────────────────────────────
echo "[e2e.sh] starting postgres + backend-relayer containers…"
export STELLAR_ADMIN_SECRET="${STELLAR_ADMIN_SECRET:-}"
export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"
"${COMPOSE[@]}" up -d --build --wait

# ── 4. seed ───────────────────────────────────────────────────────────
# Seed config was written by deploy-contracts.sh above; cleanup trap shreds it on exit.
echo "[e2e.sh] seeding database…"
pnpm --filter backend-relayer exec prisma generate >/dev/null
DATABASE_URL="$HOST_DATABASE_URL" \
  pnpm --filter backend-relayer run seed:dev --config "$SEED_CONFIG"

# ── 5. fund wallets ──────────────────────────────────────────────────
# Mints SEP-41 / ERC20 balances to flow identities + DEV_{EVM,STELLAR}_ADDRESS.
echo "[e2e.sh] funding wallets…"
pnpm --filter relayer-e2e exec tsx cli.ts fund \
  --evm-manifest "$EVM_MANIFEST" \
  --stellar-manifest "$STELLAR_MANIFEST"

# ── 6. flows ──────────────────────────────────────────────────────────
echo "[e2e.sh] running flows…"
RELAYER_URL="${RELAYER_URL:-http://localhost:2005}" \
STELLAR_CHAIN_ID="$STELLAR_CHAIN_ID_NUM" \
EVM_CHAIN_ID="$EVM_CHAIN_ID_NUM" \
  pnpm --filter relayer-e2e exec tsx cli.ts flows

echo "[e2e.sh] all phases passed ✓"
