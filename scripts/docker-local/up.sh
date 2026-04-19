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
#
# Bundle fetch + "--local" sync are delegated to the shared
# scripts/deploy/fetch-contracts-bundle.sh — the production deploy flow
# reuses the same helper so docker-local and prod stay in lockstep.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yaml"
ARTIFACTS_DIR="$SCRIPT_DIR/.artifacts"
FETCH_SCRIPT="$ROOT_DIR/scripts/deploy/fetch-contracts-bundle.sh"

# Compose auto-loads .env for container env; source it here too so up.sh
# itself (e.g. CONTRACTS_BUNDLE_TAG) sees the same values.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

USE_LOCAL=0
for arg in "$@"; do
  case "$arg" in
    --local) USE_LOCAL=1 ;;
    -h|--help)
      sed -n '3,19p' "$0"
      exit 0
      ;;
    *) echo "[up.sh] unknown flag: $arg"; exit 2 ;;
  esac
done

FETCH_ARGS=(--out "$ARTIFACTS_DIR")
if [[ $USE_LOCAL -eq 1 ]]; then
  FETCH_ARGS+=(--local)
elif [[ -n "${CONTRACTS_BUNDLE_TAG:-}" ]]; then
  FETCH_ARGS+=(--tag "$CONTRACTS_BUNDLE_TAG")
fi

echo "[up.sh] resolving contracts bundle…"
# The fetch helper prints shell exports on stdout; we only need the
# side effect of populating $ARTIFACTS_DIR, so the exports are dropped.
bash "$FETCH_SCRIPT" "${FETCH_ARGS[@]}" >/dev/null

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
