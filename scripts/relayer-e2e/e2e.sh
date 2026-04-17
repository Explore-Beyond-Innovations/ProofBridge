#!/usr/bin/env bash
set -euo pipefail

# End-to-end driver for the backend-relayer lifecycle:
#   1. start_chains.sh         — anvil + stellar localnet on the host
#   2. cli.ts deploy           — deploy contracts + write deployed.json
#   3. docker compose up       — postgres + backend-relayer (relayer runs
#                                prisma migrate deploy on boot)
#   4. cli.ts seed             — seed Postgres from deployed.json
#   5. cli.ts fund             — mint SEP-41s / ERC20s to every configured
#                                address (dev wallets + flow identities)
#   6. cli.ts flows            — exercise ad + trade lifecycles over HTTP
#   7. teardown                — compose down + stop_chains.sh
#
# Controlled via env:
#   SKIP_START_CHAINS=1        — assume chains are already running and
#                                `.chains.env` is sourced.
#   SKIP_TEARDOWN=1            — leave docker + chains running on exit.
#   SNAPSHOT_PATH              — override deployed.json location.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELAYER_DIR="$ROOT_DIR/apps/backend-relayer"
E2E_DIR="$ROOT_DIR/scripts/relayer-e2e"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-$E2E_DIR/deployed.json}"

COMPOSE_FILE="$RELAYER_DIR/docker-compose.e2e.yaml"
COMPOSE=(docker compose -f "$COMPOSE_FILE" -p relayer-e2e)

# DB URL used from the host (postgres exposes 5433:5432 in the compose file).
HOST_DATABASE_URL="${HOST_DATABASE_URL:-postgresql://relayer:relayer@localhost:5433/relayer}"

cleanup() {
  local ec=$?
  if [[ "${SKIP_TEARDOWN:-0}" == "1" ]]; then
    echo "[e2e.sh] SKIP_TEARDOWN=1 — leaving services up."
    exit "$ec"
  fi
  echo "[e2e.sh] tearing down…"
  "${COMPOSE[@]}" logs backend-relayer > "$ROOT_DIR/.relayer.log" 2>&1 || true
  "${COMPOSE[@]}" down --remove-orphans --volumes || true
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

# ── 2. deploy ─────────────────────────────────────────────────────────
echo "[e2e.sh] deploying contracts…"
cd "$E2E_DIR"
pnpm --filter relayer-e2e exec tsx cli.ts deploy --out "$SNAPSHOT_PATH"
cd "$ROOT_DIR"

# ── 3. compose up postgres + relayer ──────────────────────────────────
echo "[e2e.sh] starting postgres + backend-relayer containers…"
export STELLAR_ADMIN_SECRET="${STELLAR_ADMIN_SECRET:-}"
export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"
"${COMPOSE[@]}" up -d --build --wait

# ── 4. seed ───────────────────────────────────────────────────────────
echo "[e2e.sh] seeding database…"
# Generate prisma client against the relayer schema so seed.ts can import
# @prisma/client. Idempotent.
pnpm --filter backend-relayer exec prisma generate >/dev/null

DATABASE_URL="$HOST_DATABASE_URL" \
  pnpm --filter relayer-e2e exec tsx cli.ts seed --in "$SNAPSHOT_PATH"

# ── 5. fund wallets ──────────────────────────────────────────────────
# Mint every tradeable token to every configured address. Flow identities
# (STELLAR_{AD,ORDER}_CREATOR_SECRET) only hold XLM out of friendbot, so
# this is what unblocks routes[0] landing on a SEP-41 pair (wETH, PB).
# DEV_{EVM,STELLAR}_ADDRESS are also funded here when set.
echo "[e2e.sh] funding wallets…"
pnpm --filter relayer-e2e exec tsx cli.ts fund --in "$SNAPSHOT_PATH"

# ── 6. flows ──────────────────────────────────────────────────────────
echo "[e2e.sh] running flows…"
RELAYER_URL="${RELAYER_URL:-http://localhost:2005}" \
STELLAR_CHAIN_ID="${STELLAR_CHAIN_ID:-1000001}" \
EVM_CHAIN_ID="${EVM_CHAIN_ID:-31337}" \
  pnpm --filter relayer-e2e exec tsx cli.ts flows

echo "[e2e.sh] all phases passed ✓"
