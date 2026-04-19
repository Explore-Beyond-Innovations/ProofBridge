#!/usr/bin/env bash
set -euo pipefail

# Fetch (or sync from local tree) the Proofbridge-Contracts bundle
# used by both docker-local and the production deploy flow.
#
# Usage:
#   scripts/deploy/fetch-contracts-bundle.sh --out <dir> [--tag <sha|latest>]
#   scripts/deploy/fetch-contracts-bundle.sh --out <dir> --local
#
# On success, <dir> contains the canonical bundle layout:
#   <out>/contracts/stellar/target/wasm32v1-none/release/*.wasm
#   <out>/contracts/evm/out/<Contract>.sol/*.json
#   <out>/proof_circuits/deposits/target/vk
#
# Emits shell exports on stdout so callers can `eval "$(fetch... )"`:
#   EVM_OUT_DIR=<out>/contracts/evm/out
#   STELLAR_WASM_DIR=<out>/contracts/stellar/target/wasm32v1-none/release
#   STELLAR_DEPOSIT_VK=<out>/proof_circuits/deposits/target/vk

log() { echo "[fetch-bundle] $*" >&2; }

GH_REPO="${CONTRACTS_BUNDLE_REPO:-Explore-Beyond-Innovations/ProofBridge}"
BUNDLE_TAG=""
OUT_DIR=""
USE_LOCAL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)   OUT_DIR="$2"; shift 2 ;;
    --tag)   BUNDLE_TAG="$2"; shift 2 ;;
    --local) USE_LOCAL=1; shift ;;
    -h|--help)
      sed -n '3,24p' "$0" >&2; exit 0 ;;
    *) log "unknown flag: $1"; exit 2 ;;
  esac
done

if [[ -z "$OUT_DIR" ]]; then
  log "--out <dir> is required"; exit 2
fi
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Allow the caller to override where `--local` reads from (useful inside
# the docker-local deployer container where scripts/ is bind-mounted at
# a path that's not `../..` relative to its own repo checkout).
ROOT_DIR="${CONTRACTS_ROOT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

have_artifact() {
  local stellar_wasm="$OUT_DIR/contracts/stellar/target/wasm32v1-none/release"
  local evm_out="$OUT_DIR/contracts/evm/out"
  for w in verifier.wasm merkle_manager.wasm ad_manager.wasm order_portal.wasm test_token.wasm; do
    [[ -f "$stellar_wasm/$w" ]] || return 1
  done
  for c in OrderPortal AdManager MerkleManager Verifier wNativeToken MockERC20; do
    [[ -d "$evm_out/${c}.sol" ]] || return 1
  done
  [[ -f "$OUT_DIR/proof_circuits/deposits/target/vk" ]]
}

sync_from_local_tree() {
  log "--local: syncing from $ROOT_DIR"
  local stellar_wasm="$ROOT_DIR/contracts/stellar/target/wasm32v1-none/release"
  local evm_out="$ROOT_DIR/contracts/evm/out"
  local vk="$ROOT_DIR/proof_circuits/deposits/target/vk"

  for f in verifier.wasm merkle_manager.wasm ad_manager.wasm order_portal.wasm test_token.wasm; do
    if [[ ! -f "$stellar_wasm/$f" ]]; then
      log "missing $stellar_wasm/$f — run 'stellar contract build' first"; exit 1
    fi
  done
  for c in OrderPortal AdManager MerkleManager Verifier wNativeToken MockERC20; do
    if [[ ! -d "$evm_out/${c}.sol" ]]; then
      log "missing $evm_out/${c}.sol — run 'forge build' in contracts/evm first"; exit 1
    fi
  done
  if [[ ! -f "$vk" ]]; then
    log "missing $vk — run scripts/build_circuits.sh proof_circuits/deposits first"; exit 1
  fi

  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR/contracts/stellar/target/wasm32v1-none/release" \
           "$OUT_DIR/contracts/evm/out" \
           "$OUT_DIR/proof_circuits/deposits/target"
  cp "$stellar_wasm"/*.wasm "$OUT_DIR/contracts/stellar/target/wasm32v1-none/release/"
  cp -r "$evm_out"/. "$OUT_DIR/contracts/evm/out/"
  cp "$vk" "$OUT_DIR/proof_circuits/deposits/target/vk"
}

download_bundle() {
  local tag="${BUNDLE_TAG:-latest}"
  local url="https://github.com/${GH_REPO}/releases/download/${tag}/contracts-bundle.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  log "downloading $tag from $GH_REPO…"
  if ! curl -fsSL "$url" -o "$tmp/bundle.tgz"; then
    log "failed to fetch $url"
    log "(is the tag published? try --tag latest or --local)"
    exit 1
  fi

  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"
  # Reject absolute paths or `..` components before extracting (defence in depth).
  if tar -tzf "$tmp/bundle.tgz" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    log "bundle contains unsafe paths; refusing to extract"; exit 1
  fi
  tar -xzf "$tmp/bundle.tgz" -C "$OUT_DIR"
  log "extracted bundle → $OUT_DIR"
}

if [[ $USE_LOCAL -eq 1 ]]; then
  sync_from_local_tree
else
  # If the caller pinned a tag, always redownload to make the choice explicit.
  # Otherwise, reuse a cached extract when it's already complete.
  if [[ -n "$BUNDLE_TAG" ]] || ! have_artifact; then
    download_bundle
  else
    log "reusing cached artifacts in $OUT_DIR (pass --tag to force refresh)"
  fi
fi

if ! have_artifact; then
  log "artifact layout incomplete under $OUT_DIR"; exit 1
fi

# Emit shell-escaped exports so `eval "$(fetch-contracts-bundle.sh …)"` survives paths containing quotes/spaces.
printf 'export EVM_OUT_DIR=%q\n'       "$OUT_DIR/contracts/evm/out"
printf 'export STELLAR_WASM_DIR=%q\n'  "$OUT_DIR/contracts/stellar/target/wasm32v1-none/release"
printf 'export STELLAR_DEPOSIT_VK=%q\n' "$OUT_DIR/proof_circuits/deposits/target/vk"
