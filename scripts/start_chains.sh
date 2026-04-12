#!/usr/bin/env bash
set -euo pipefail

# Cross-chain dev-environment bring-up.
# Starts a Stellar localnet (Docker) and Anvil (EVM), builds all prerequisites,
# funds keypairs, and exposes the resulting addresses/keys/secrets as
# environment variables. This script does NOT run any test — the caller is
# expected to consume the exported env and run whichever command they want
# (e.g. `npx tsx scripts/cross-chain-e2e/run.ts` or
# `pnpm --filter backend-relayer test:integrations`).
#
# Outputs:
#   - Writes all exports to `<repo>/.chains.env` (source it in another shell).
#   - Appends to $GITHUB_ENV when running under GitHub Actions so subsequent
#     job steps inherit the values automatically.
#   - Writes Anvil's PID to `<repo>/.chains.anvil.pid` so a teardown script
#     can stop it later (Stellar container is stopped via `stellar container
#     stop $STELLAR_CONTAINER_NAME`).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── configuration ────────────────────────────────────────────────────

CONTAINER_NAME="${STELLAR_CONTAINER_NAME:-stellar-e2e}"
NETWORK_NAME="${STELLAR_NETWORK_NAME:-local}"
STELLAR_RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}"
NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"

# apps/backend-relayer/src/providers/viem/ethers/localnet.ts pins 9545;
# scripts/cross-chain-e2e/run.ts reads EVM_RPC_URL so it is port-agnostic.
ANVIL_PORT="${ANVIL_PORT:-9545}"
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

# Anvil prefunded keys — #0 admin, #1 order creator, #2 ad-creator EVM side.
EVM_ADMIN_PRIVATE_KEY="${EVM_ADMIN_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
EVM_ORDER_CREATOR_PRIVATE_KEY="${EVM_ORDER_CREATOR_PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
EVM_AD_CREATOR_PRIVATE_KEY="${EVM_AD_CREATOR_PRIVATE_KEY:-0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a}"
AD_CREATOR_EVM_RECIPIENT="${AD_CREATOR_EVM_RECIPIENT:-0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC}"

# stellar.ts reads STELLAR_SOURCE_ACCOUNT as the default CLI source.
export STELLAR_SOURCE_ACCOUNT="$STELLAR_ADMIN_ACCOUNT"

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

# Dump Stellar secret seeds so Node-side tests can sign without re-running
# the CLI. `stellar keys show` prints just the S… strkey.
STELLAR_ADMIN_SECRET="$(stellar keys show "$STELLAR_ADMIN_ACCOUNT")"
STELLAR_AD_CREATOR_SECRET="$(stellar keys show "$STELLAR_AD_CREATOR_ACCOUNT")"
STELLAR_ORDER_CREATOR_SECRET="$(stellar keys show "$STELLAR_ORDER_CREATOR_ACCOUNT")"

# ── start Anvil ──────────────────────────────────────────────────────

echo ""
echo "=== Starting Anvil (EVM devnet) ==="
lsof -ti :"$ANVIL_PORT" | xargs -r kill -9 2>/dev/null || true
sleep 1
# nohup + disown keeps Anvil alive after this script exits, so downstream
# CI steps (or a separate dev shell) can talk to it.
nohup anvil --host 0.0.0.0 --port "$ANVIL_PORT" --block-time 2 --silent \
  > "$ROOT_DIR/.chains.anvil.log" 2>&1 &
ANVIL_PID=$!
disown "$ANVIL_PID" || true
echo "$ANVIL_PID" > "$ROOT_DIR/.chains.anvil.pid"
sleep 2

if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
  echo "Anvil failed to start — see $ROOT_DIR/.chains.anvil.log" >&2
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

# ── expose addresses, keys, and secrets ──────────────────────────────

ENV_FILE="$ROOT_DIR/.chains.env"
: > "$ENV_FILE"

emit() {
  local key="$1"
  local val="$2"
  # Quote the value so passphrases with spaces/semicolons survive a round-trip
  # through `source`. Single-quote-safe: escape any ' by closing, escaping, reopening.
  local escaped="${val//\'/\'\\\'\'}"
  echo "export ${key}='${escaped}'" >> "$ENV_FILE"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    # $GITHUB_ENV uses plain KEY=VALUE (no export, no quoting).
    # Multiline-safe form isn't needed here since none of these contain newlines.
    echo "${key}=${val}" >> "$GITHUB_ENV"
  fi
}

emit STELLAR_RPC_URL "$STELLAR_RPC_URL"
emit STELLAR_NETWORK "$NETWORK_NAME"
emit STELLAR_NETWORK_PASSPHRASE "$NETWORK_PASSPHRASE"
emit STELLAR_CONTAINER_NAME "$CONTAINER_NAME"
emit STELLAR_SOURCE_ACCOUNT "$STELLAR_ADMIN_ACCOUNT"
emit STELLAR_ADMIN_ACCOUNT "$STELLAR_ADMIN_ACCOUNT"
emit STELLAR_AD_CREATOR_ACCOUNT "$STELLAR_AD_CREATOR_ACCOUNT"
emit STELLAR_ORDER_CREATOR_ACCOUNT "$STELLAR_ORDER_CREATOR_ACCOUNT"
emit STELLAR_ADMIN_SECRET "$STELLAR_ADMIN_SECRET"
emit STELLAR_AD_CREATOR_SECRET "$STELLAR_AD_CREATOR_SECRET"
emit STELLAR_ORDER_CREATOR_SECRET "$STELLAR_ORDER_CREATOR_SECRET"
emit EVM_RPC_URL "$EVM_RPC_URL"
emit EVM_ADMIN_PRIVATE_KEY "$EVM_ADMIN_PRIVATE_KEY"
emit EVM_ORDER_CREATOR_PRIVATE_KEY "$EVM_ORDER_CREATOR_PRIVATE_KEY"
emit EVM_AD_CREATOR_PRIVATE_KEY "$EVM_AD_CREATOR_PRIVATE_KEY"
emit AD_CREATOR_EVM_RECIPIENT "$AD_CREATOR_EVM_RECIPIENT"
emit ROOT_DIR "$ROOT_DIR"

echo ""
echo "=== Chains ready ==="
echo "Env written to:  $ENV_FILE"
echo "Anvil log:       $ROOT_DIR/.chains.anvil.log"
echo "Anvil PID file:  $ROOT_DIR/.chains.anvil.pid"
echo ""
echo "Next steps:"
echo "  - local dev:  source $ENV_FILE && <your test command>"
echo "  - CI:         env inherited via \$GITHUB_ENV in subsequent steps"
echo "  - teardown:   bash scripts/stop_chains.sh"
