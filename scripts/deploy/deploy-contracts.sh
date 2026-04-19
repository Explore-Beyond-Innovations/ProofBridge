#!/usr/bin/env bash
set -euo pipefail

# Top-level deploy orchestrator. Deploys N chains, links every ordered
# pair, optionally emits a seed config for the backend-relayer seeder.
#
# Usage:
#   scripts/deploy/deploy-contracts.sh [flags]
#
# Flags:
#   --chains <names>          Comma-separated chain list. Each entry maps
#                             to contracts/<name>/deploy/. Defaults to
#                             "evm,stellar".
#   --tag <sha|latest>        Contracts bundle tag (default:
#                             $CONTRACTS_BUNDLE_TAG, else `latest`)
#   --local                   Use the local repo tree instead of a bundle
#   --no-fetch                Skip the bundle fetch. Caller must have set
#                             EVM_OUT_DIR, STELLAR_WASM_DIR,
#                             STELLAR_DEPOSIT_VK (for the chains involved).
#   --with-test-tokens        Also run deploy-test-tokens on each chain
#   --fresh                   Delete any existing manifest for the target
#                             chains before deploying, forcing a clean run.
#                             Use for ephemeral networks (anvil / stellar
#                             localnet) where reuse would point at addresses
#                             that no longer exist.
#   --skip-link               Deploy but don't link chains together
#   --evm-env <file>          Source before EVM steps
#   --stellar-env <file>      Source before Stellar steps
#   --seed-config-out <path>  Emit a seed.config.yaml listing the deployed
#                             chains' manifests (consumed by the relayer's
#                             `pnpm seed:dev --config <path>`).
#   --admin-email <email>     Seed config admin email (default:
#                             $ADMIN_EMAIL or "admin@x.com")
#   --admin-password <pass>   Seed config admin password (default:
#                             $ADMIN_PASSWORD or "ChangeMe123!")
#
# Required env:
#   Per-chain env (RPC / keys / identity) expected by each per-chain CLI.
#
# Optional env:
#   DEPLOY_ENV (default: local), GIT_COMMIT (auto from git),
#   CONTRACTS_BUNDLE_DIR (default: scripts/deploy/.bundle)

log() { echo "[deploy] $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUNDLE_DIR="${CONTRACTS_BUNDLE_DIR:-$SCRIPT_DIR/.bundle}"

CHAINS_CSV="evm,stellar"
BUNDLE_TAG="${CONTRACTS_BUNDLE_TAG:-}"
USE_LOCAL=0
NO_FETCH=0
WITH_TEST_TOKENS=0
FRESH=0
SKIP_LINK=0
EVM_ENV_FILE=""
STELLAR_ENV_FILE=""
SEED_CONFIG_OUT=""
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@x.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --chains)           CHAINS_CSV="$2"; shift 2 ;;
    --tag)              BUNDLE_TAG="$2"; shift 2 ;;
    --local)            USE_LOCAL=1; shift ;;
    --no-fetch)         NO_FETCH=1; shift ;;
    --with-test-tokens) WITH_TEST_TOKENS=1; shift ;;
    --fresh)            FRESH=1; shift ;;
    --skip-link)        SKIP_LINK=1; shift ;;
    --evm-env)          EVM_ENV_FILE="$2"; shift 2 ;;
    --stellar-env)      STELLAR_ENV_FILE="$2"; shift 2 ;;
    --seed-config-out)  SEED_CONFIG_OUT="$2"; shift 2 ;;
    --admin-email)      ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password)   ADMIN_PASSWORD="$2"; shift 2 ;;
    -h|--help)          sed -n '3,42p' "$0" >&2; exit 0 ;;
    *) log "unknown flag: $1"; exit 2 ;;
  esac
done

# ── parse + validate chain list ─────────────────────────────────────
IFS=',' read -ra CHAINS <<< "$CHAINS_CSV"
if [[ ${#CHAINS[@]} -eq 0 ]]; then
  log "--chains cannot be empty"; exit 2
fi
for chain in "${CHAINS[@]}"; do
  pkg="$ROOT_DIR/contracts/$chain/deploy/package.json"
  if [[ ! -f "$pkg" ]]; then
    log "unknown chain \"$chain\" (no $pkg)"; exit 2
  fi
done
log "chains: ${CHAINS[*]}"

# ── fetch bundle → export artifact paths ─────────────────────────────
if [[ $NO_FETCH -eq 1 ]]; then
  log "--no-fetch: reusing caller-provided artifact paths"
else
  log "preparing contracts bundle in $BUNDLE_DIR"
  FETCH_ARGS=(--out "$BUNDLE_DIR")
  if [[ $USE_LOCAL -eq 1 ]]; then
    FETCH_ARGS+=(--local)
  elif [[ -n "$BUNDLE_TAG" ]]; then
    FETCH_ARGS+=(--tag "$BUNDLE_TAG")
  fi
  # shellcheck disable=SC1090
  eval "$(bash "$SCRIPT_DIR/fetch-contracts-bundle.sh" "${FETCH_ARGS[@]}")"
fi

# ── source per-chain env files if provided ───────────────────────────
if [[ -n "$EVM_ENV_FILE" && -f "$EVM_ENV_FILE" ]]; then
  log "sourcing EVM env from $EVM_ENV_FILE"
  set -a; source "$EVM_ENV_FILE"; set +a
fi
if [[ -n "$STELLAR_ENV_FILE" && -f "$STELLAR_ENV_FILE" ]]; then
  log "sourcing Stellar env from $STELLAR_ENV_FILE"
  set -a; source "$STELLAR_ENV_FILE"; set +a
fi

if [[ -z "${GIT_COMMIT:-}" ]] && git -C "$ROOT_DIR" rev-parse --short HEAD >/dev/null 2>&1; then
  export GIT_COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
fi

# ── optional fresh-start: wipe stale manifests ───────────────────────
# Per-chain CLIs default to reuse; wipe manifests so ephemeral localnets start clean.
if [[ $FRESH -eq 1 ]]; then
  for chain in "${CHAINS[@]}"; do
    dir="$ROOT_DIR/contracts/$chain/deployments"
    if compgen -G "$dir/*.json" > /dev/null; then
      log "[fresh] removing stale manifests in $dir"
      rm -f "$dir"/*.json
    fi
  done
fi

# ── deploy each chain ────────────────────────────────────────────────
for chain in "${CHAINS[@]}"; do
  log "deploying $chain core"
  ( cd "$ROOT_DIR/contracts/$chain/deploy" && pnpm --silent cli deploy )
done

if [[ $WITH_TEST_TOKENS -eq 1 ]]; then
  for chain in "${CHAINS[@]}"; do
    log "deploying $chain test tokens"
    ( cd "$ROOT_DIR/contracts/$chain/deploy" && pnpm --silent cli deploy-test-tokens )
  done
fi

# ── resolve each chain's latest manifest ─────────────────────────────
declare -A MANIFEST
for chain in "${CHAINS[@]}"; do
  dir_override_var="${chain^^}_DEPLOYMENTS_DIR"
  manifest_dir="${!dir_override_var:-$ROOT_DIR/contracts/$chain/deployments}"
  found="$(ls -t "$manifest_dir"/*.json 2>/dev/null | head -n1 || true)"
  if [[ -z "$found" ]]; then
    log "no manifest emitted under $manifest_dir for chain=$chain"; exit 1
  fi
  MANIFEST[$chain]="$found"
  log "$chain manifest: $found"
done

# ── link every ordered pair ──────────────────────────────────────────
if [[ $SKIP_LINK -eq 1 ]]; then
  log "skipping link step (--skip-link)"
elif [[ ${#CHAINS[@]} -lt 2 ]]; then
  log "only 1 chain configured — no peers to link against"
else
  for local_chain in "${CHAINS[@]}"; do
    for peer_chain in "${CHAINS[@]}"; do
      [[ "$local_chain" == "$peer_chain" ]] && continue
      log "linking $local_chain → $peer_chain"
      ( cd "$ROOT_DIR/contracts/$local_chain/deploy" && \
        pnpm --silent cli link --peer "${MANIFEST[$peer_chain]}" )
    done
  done
fi

# ── optional: emit a seed config covering every deployed chain ───────
if [[ -n "$SEED_CONFIG_OUT" ]]; then
  mkdir -p "$(dirname "$SEED_CONFIG_OUT")"
  {
    echo "admin:"
    echo "  email: $ADMIN_EMAIL"
    echo "  password: $ADMIN_PASSWORD"
    echo
    echo "chains:"
    for chain in "${CHAINS[@]}"; do
      echo "  - manifest: ${MANIFEST[$chain]}"
    done
  } > "$SEED_CONFIG_OUT"
  chmod 600 "$SEED_CONFIG_OUT"
  log "wrote seed config → $SEED_CONFIG_OUT"
fi

log "done ✓"
