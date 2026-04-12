#!/usr/bin/env bash
set -euo pipefail

# Cross-chain E2E test orchestrator.
# Starts a Stellar localnet (Docker) and Anvil (EVM), builds all prerequisites,
# then runs the TypeScript test that exercises the full bridge flow.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$ROOT_DIR/scripts/cross-chain-e2e"

# ── configuration ────────────────────────────────────────────────────

CONTAINER_NAME="${STELLAR_CONTAINER_NAME:-stellar-e2e}"
NETWORK_NAME="${STELLAR_NETWORK_NAME:-local}"
SOURCE_ACCOUNT="${STELLAR_SOURCE_ACCOUNT:-alice}"
STELLAR_RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}"
NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"

ANVIL_PORT="${ANVIL_PORT:-8545}"
EVM_RPC_URL="http://localhost:$ANVIL_PORT"
# Anvil default funded account #0
EVM_PRIVATE_KEY="${EVM_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

ANVIL_PID=""

# ── cleanup ──────────────────────────────────────────────────────────

cleanup() {
  echo ""
  echo "Cleaning up..."
  [[ -n "$ANVIL_PID" ]] && kill "$ANVIL_PID" 2>/dev/null || true
  stellar container stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  echo "Done."
}
trap cleanup EXIT

# ── start Stellar localnet ───────────────────────────────────────────

echo "=== Starting Stellar quickstart container ==="
stellar container stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
stellar container start -t future --name "$CONTAINER_NAME" --limits unlimited

echo "Configuring local network profile..."
stellar network remove "$NETWORK_NAME" >/dev/null 2>&1 || true
stellar network add "$NETWORK_NAME" \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE"
stellar network use "$NETWORK_NAME"

echo "Waiting for Stellar localnet to become healthy..."
HEALTHY=0
for attempt in $(seq 1 60); do
  HEALTH_JSON=$(stellar network health --network "$NETWORK_NAME" --output json 2>/dev/null || true)
  if echo "$HEALTH_JSON" | grep -q '"status":"healthy"'; then
    HEALTHY=1
    break
  fi
  echo "  not ready yet (attempt $attempt/60), waiting..."
  sleep 5
done
if [[ "$HEALTHY" -ne 1 ]]; then
  echo "Stellar network failed to become healthy" >&2
  stellar container logs "$CONTAINER_NAME" | tail -n 100 || true
  exit 1
fi
echo "Stellar localnet is healthy."

echo "Preparing source account..."
stellar keys generate "$SOURCE_ACCOUNT" >/dev/null 2>&1 || true
FUND_OK=0
for attempt in $(seq 1 30); do
  if stellar keys fund "$SOURCE_ACCOUNT" --network "$NETWORK_NAME" 2>/dev/null; then
    FUND_OK=1
    break
  fi
  echo "  friendbot not ready yet (attempt $attempt/30), waiting..."
  sleep 10
done
if [[ "$FUND_OK" -ne 1 ]]; then
  echo "Failed to fund $SOURCE_ACCOUNT" >&2
  exit 1
fi
echo "Source account funded."

# ── start Anvil ──────────────────────────────────────────────────────

echo ""
echo "=== Starting Anvil (EVM devnet) ==="
anvil --host 0.0.0.0 --port "$ANVIL_PORT" --silent &
ANVIL_PID=$!
sleep 2

if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
  echo "Anvil failed to start" >&2
  exit 1
fi
echo "Anvil running on port $ANVIL_PORT (PID $ANVIL_PID)."

# ── build prerequisites ─────────────────────────────────────────────

echo ""
echo "=== Building prerequisites ==="

echo "Building deposit circuit..."
bash "$ROOT_DIR/scripts/build_circuits.sh" "$ROOT_DIR/proof_circuits/deposits"

echo "Building Stellar contract WASMs..."
rustup target add wasm32v1-none >/dev/null 2>&1 || true
cd "$ROOT_DIR/contracts/stellar"
stellar contract build --package verifier
stellar contract build --package merkle-manager
stellar contract build --package ad-manager
stellar contract build --package order-portal
cd "$ROOT_DIR"

echo "Building EVM contracts..."
cd "$ROOT_DIR/contracts/evm"
forge build --silent
cd "$ROOT_DIR"

# ── run the TypeScript test ──────────────────────────────────────────

echo ""
echo "=== Running cross-chain E2E test ==="

export STELLAR_RPC_URL
export STELLAR_NETWORK="$NETWORK_NAME"
export STELLAR_SOURCE_ACCOUNT="$SOURCE_ACCOUNT"
export STELLAR_NETWORK_PASSPHRASE="$NETWORK_PASSPHRASE"
export EVM_RPC_URL
export EVM_PRIVATE_KEY
export ROOT_DIR

cd "$SCRIPT_DIR"
npx tsx run.ts

echo ""
echo "=== Cross-chain E2E test passed! ==="
