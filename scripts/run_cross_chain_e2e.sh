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
STELLAR_RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}"
NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"

ANVIL_PORT="${ANVIL_PORT:-8545}"
# Use 127.0.0.1 explicitly — on GitHub runners, Node resolves "localhost"
# to ::1 first, which fails to reach Anvil (bound on IPv4 0.0.0.0).
EVM_RPC_URL="http://127.0.0.1:$ANVIL_PORT"

# ── user roles (4 actors drive the flow) ─────────────────────────────
# 1. Stellar admin     — configures the Stellar AdManager contract.
# 2. EVM admin         — configures the EVM OrderPortal contract.
# 3. Ad creator        — Stellar identity creates the ad + locks XLM in;
#                        supplies an EVM address to receive tokens on unlock.
# 4. Order creator     — EVM identity creates the order; supplies a Stellar
#    (aka bridger)       identity (its key must be in the CLI keystore since
#                        unlock calls order_recipient.require_auth()).

STELLAR_ADMIN_ACCOUNT="${STELLAR_ADMIN_ACCOUNT:-admin}"
STELLAR_AD_CREATOR_ACCOUNT="${STELLAR_AD_CREATOR_ACCOUNT:-alice}"
STELLAR_ORDER_CREATOR_ACCOUNT="${STELLAR_ORDER_CREATOR_ACCOUNT:-bridger}"

# Anvil prefunded keys — #0 admin, #1 order creator.
EVM_ADMIN_PRIVATE_KEY="${EVM_ADMIN_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
EVM_ORDER_CREATOR_PRIVATE_KEY="${EVM_ORDER_CREATOR_PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
# Ad creator's EVM recipient — receive-only, no key needed. Defaults to
# Anvil prefunded account #2's address.
AD_CREATOR_EVM_RECIPIENT="${AD_CREATOR_EVM_RECIPIENT:-0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC}"

# stellar.ts reads STELLAR_SOURCE_ACCOUNT as the default CLI source.
export STELLAR_SOURCE_ACCOUNT="$STELLAR_ADMIN_ACCOUNT"

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

echo "Preparing Stellar accounts (admin, ad creator, order creator)..."
for acct in "$STELLAR_ADMIN_ACCOUNT" "$STELLAR_AD_CREATOR_ACCOUNT" "$STELLAR_ORDER_CREATOR_ACCOUNT"; do
  stellar keys generate "$acct" >/dev/null 2>&1 || true
done

for acct in "$STELLAR_ADMIN_ACCOUNT" "$STELLAR_AD_CREATOR_ACCOUNT" "$STELLAR_ORDER_CREATOR_ACCOUNT"; do
  FUND_OK=0
  for attempt in $(seq 1 30); do
    if stellar keys fund "$acct" --network "$NETWORK_NAME" 2>/dev/null; then
      FUND_OK=1
      break
    fi
    echo "  friendbot not ready for '$acct' (attempt $attempt/30), waiting..."
    sleep 10
  done
  if [[ "$FUND_OK" -ne 1 ]]; then
    echo "Failed to fund $acct" >&2
    exit 1
  fi
done
echo "Stellar accounts funded."

# ── start Anvil ──────────────────────────────────────────────────────

echo ""
echo "=== Starting Anvil (EVM devnet) ==="
# Kill any existing Anvil on the target port
lsof -ti :"$ANVIL_PORT" | xargs -r kill -9 2>/dev/null || true
sleep 1
anvil --host 0.0.0.0 --port "$ANVIL_PORT" --block-time 2 --silent &
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
export STELLAR_NETWORK_PASSPHRASE="$NETWORK_PASSPHRASE"
export STELLAR_ADMIN_ACCOUNT
export STELLAR_AD_CREATOR_ACCOUNT
export STELLAR_ORDER_CREATOR_ACCOUNT
export EVM_RPC_URL
export EVM_ADMIN_PRIVATE_KEY
export EVM_ORDER_CREATOR_PRIVATE_KEY
export AD_CREATOR_EVM_RECIPIENT
export ROOT_DIR

cd "$SCRIPT_DIR"
npx tsx run.ts

echo ""
echo "=== Cross-chain E2E test passed! ==="
