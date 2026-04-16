#!/usr/bin/env bash
set -euo pipefail

# Brings up the full local stack: chains + postgres + deployer + relayer.
# Relayer is exposed at http://localhost:2005 on success.
#
# Contract artifacts (Stellar WASMs, EVM ABIs, deposit VK) are pulled from
# the public Proofbridge-Contracts `latest` GitHub Release by default — no
# host toolchain required. Override with:
#   CONTRACTS_BUNDLE_TAG=<short-sha>       pin a specific build
#   up.sh --local                          use the repo's locally-built tree
#                                          (skips download; assumes you ran
#                                          `stellar contract build`, `forge
#                                          build`, and `scripts/build_circuits.sh`
#                                          yourself)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yaml"
ARTIFACTS_DIR="$SCRIPT_DIR/.artifacts"

# Compose auto-loads .env for container env; source it here too so up.sh
# itself (e.g. CONTRACTS_BUNDLE_TAG) sees the same values.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

GH_REPO="${CONTRACTS_BUNDLE_REPO:-Explore-Beyond-Innovations/ProofBridge}"
BUNDLE_TAG="${CONTRACTS_BUNDLE_TAG:-latest}"

USE_LOCAL=0
for arg in "$@"; do
  case "$arg" in
    --local) USE_LOCAL=1 ;;
    -h|--help)
      sed -n '3,16p' "$0"
      exit 0
      ;;
    *) echo "[up.sh] unknown flag: $arg"; exit 2 ;;
  esac
done

have_artifact() {
  local stellar_wasm="$ARTIFACTS_DIR/contracts/stellar/target/wasm32v1-none/release"
  local evm_out="$ARTIFACTS_DIR/contracts/evm/out"
  for w in verifier.wasm merkle_manager.wasm ad_manager.wasm order_portal.wasm test_token.wasm; do
    [[ -f "$stellar_wasm/$w" ]] || return 1
  done
  for c in OrderPortal AdManager MerkleManager Verifier wNativeToken MockERC20; do
    [[ -d "$evm_out/${c}.sol" ]] || return 1
  done
  [[ -f "$ARTIFACTS_DIR/proof_circuits/deposits/target/vk" ]]
}

sync_from_local_tree() {
  echo "[up.sh] --local: bind-mounting locally-built artifacts…"
  local stellar_wasm="$ROOT_DIR/contracts/stellar/target/wasm32v1-none/release"
  local evm_out="$ROOT_DIR/contracts/evm/out"
  local vk="$ROOT_DIR/proof_circuits/deposits/target/vk"

  for f in verifier.wasm merkle_manager.wasm ad_manager.wasm order_portal.wasm test_token.wasm; do
    if [[ ! -f "$stellar_wasm/$f" ]]; then
      echo "[up.sh] missing $stellar_wasm/$f — run 'stellar contract build' first" >&2
      exit 1
    fi
  done
  for c in OrderPortal AdManager MerkleManager Verifier wNativeToken MockERC20; do
    if [[ ! -d "$evm_out/${c}.sol" ]]; then
      echo "[up.sh] missing $evm_out/${c}.sol — run 'forge build' in contracts/evm first" >&2
      exit 1
    fi
  done
  if [[ ! -f "$vk" ]]; then
    echo "[up.sh] missing $vk — run scripts/build_circuits.sh proof_circuits/deposits first" >&2
    exit 1
  fi

  rm -rf "$ARTIFACTS_DIR"
  mkdir -p "$ARTIFACTS_DIR/contracts/stellar/target/wasm32v1-none/release" \
           "$ARTIFACTS_DIR/contracts/evm/out" \
           "$ARTIFACTS_DIR/proof_circuits/deposits/target"
  cp "$stellar_wasm"/*.wasm "$ARTIFACTS_DIR/contracts/stellar/target/wasm32v1-none/release/"
  cp -r "$evm_out"/. "$ARTIFACTS_DIR/contracts/evm/out/"
  cp "$vk" "$ARTIFACTS_DIR/proof_circuits/deposits/target/vk"
}

download_bundle() {
  local url="https://github.com/${GH_REPO}/releases/download/${BUNDLE_TAG}/contracts-bundle.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  echo "[up.sh] downloading $BUNDLE_TAG from $GH_REPO…"
  if ! curl -fsSL "$url" -o "$tmp/bundle.tgz"; then
    echo "[up.sh] failed to fetch $url" >&2
    echo "[up.sh] (is the tag published? try \`CONTRACTS_BUNDLE_TAG=latest\` or \`--local\`)" >&2
    exit 1
  fi

  rm -rf "$ARTIFACTS_DIR"
  mkdir -p "$ARTIFACTS_DIR"
  tar -xzf "$tmp/bundle.tgz" -C "$ARTIFACTS_DIR"
  echo "[up.sh] extracted bundle → $ARTIFACTS_DIR"
}

if [[ $USE_LOCAL -eq 1 ]]; then
  sync_from_local_tree
else
  if [[ -n "${CONTRACTS_BUNDLE_TAG:-}" ]] || ! have_artifact; then
    download_bundle
  else
    echo "[up.sh] reusing cached artifacts in $ARTIFACTS_DIR (set CONTRACTS_BUNDLE_TAG to force refresh)"
  fi
fi

if ! have_artifact; then
  echo "[up.sh] artifact layout incomplete under $ARTIFACTS_DIR" >&2
  exit 1
fi

echo "[up.sh] building + starting services…"
docker compose -f "$COMPOSE_FILE" up -d --build --wait

echo ""
echo "[up.sh] stack is up ✓"
echo "  relayer:   http://localhost:2005"
echo "  postgres:  postgresql://relayer:relayer@localhost:5433/relayer"
echo "  anvil:     http://localhost:9545"
echo "  stellar:   http://localhost:8000  (soroban RPC: /soroban/rpc)"
echo ""
echo "[up.sh] follow logs with:"
echo "  docker compose -f $COMPOSE_FILE logs -f backend-relayer"
echo "[up.sh] tear down with:"
echo "  bash scripts/docker-local/down.sh"
