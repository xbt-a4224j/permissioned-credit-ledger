#!/usr/bin/env bash
# Idempotent teardown — free the 4 fixed ports + stop every service · #31
# STOP is the first phase of dev.sh and also a standalone command (`bun run stop`). It is
# idempotent: run it twice and both succeed. It (a) kills every recorded pidfile (anvil/indexer/
# api/web), (b) tears down the Postgres compose project (volume-wiped so each start is clean), and
# (c) frees all 4 fixed ports via lsof in case anything (ours or a foreign squatter) still holds one.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

echo "[stop] tearing down the stack…"

# 1. kill our recorded background processes (anvil/indexer/api/web) by pidfile.
kill_all_pidfiles

# 2. stop + remove the Postgres compose project (volume-wiped: deterministic next start).
if command -v docker >/dev/null 2>&1; then
  docker compose -p "${COMPOSE_PROJECT}" -f "${REPO_ROOT}/docker-compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
fi

# 3. free every fixed port (idempotent — no-op when already free).
for port in $(fixed_ports); do
  free_port "${port}"
done

echo "[stop] done — ports $(fixed_ports) are free."
