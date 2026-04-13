#!/usr/bin/env bash
set -uo pipefail

# Tears down the chains brought up by start_chains.sh.
# Stops Anvil (via PID file) and the Stellar quickstart container.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENV_FILE="$ROOT_DIR/.chains.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

PID_FILE="$ROOT_DIR/.chains.anvil.pid"
if [[ -f "$PID_FILE" ]]; then
  ANVIL_PID="$(cat "$PID_FILE")"
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    CMD="$(ps -o comm= -p "$ANVIL_PID" 2>/dev/null || true)"
    if [[ "$CMD" == anvil* ]]; then
      echo "Stopping Anvil (PID $ANVIL_PID)..."
      kill "$ANVIL_PID" 2>/dev/null || true
    else
      echo "Skipping stale PID $ANVIL_PID (now: '${CMD:-unknown}')."
    fi
  fi
  rm -f "$PID_FILE"
fi

CONTAINER_NAME="${STELLAR_CONTAINER_NAME:-stellar-e2e}"
echo "Stopping Stellar container '$CONTAINER_NAME'..."
stellar container stop "$CONTAINER_NAME" >/dev/null 2>&1 || true

rm -f "$ROOT_DIR/.chains.env" "$ROOT_DIR/.chains.anvil.log"

echo "Done."
