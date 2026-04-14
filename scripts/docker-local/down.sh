#!/usr/bin/env bash
set -uo pipefail

# Tears down the local stack. Pass --reset to also wipe volumes (postgres
# data + shared deploy snapshot), forcing a fresh contract deploy next up.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/scripts/docker-local/docker-compose.yaml"

RESET=0
for arg in "$@"; do
  case "$arg" in
    --reset|-r) RESET=1 ;;
    *) echo "[down.sh] unknown flag: $arg"; exit 2 ;;
  esac
done

if [[ "$RESET" -eq 1 ]]; then
  echo "[down.sh] tearing down + wiping volumes…"
  docker compose -f "$COMPOSE_FILE" down --remove-orphans --volumes
else
  echo "[down.sh] tearing down (volumes preserved — pass --reset to wipe)…"
  docker compose -f "$COMPOSE_FILE" down --remove-orphans
fi

echo "[down.sh] done."
