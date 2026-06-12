#!/usr/bin/env bash
# The fixed port map + idempotent port/health helpers · #31
# Single source of the 4 fixed, non-default ports (CLAUDE.md ports table) and the small toolbox
# dev.sh / stop.sh share: free a port (lsof), wait for a TCP / HTTP / RPC health gate (bounded
# poll, never a blind sleep), and pidfile bookkeeping under .dev/. POSIX-bash + lsof + curl only —
# no heavy task runner. Override any port via the environment (or .env) before sourcing.
set -euo pipefail

# #31 the fixed, non-conflicting ports (avoid common dev ports 3000/5173/5432/8545/8080).
export PG_PORT="${PG_PORT:-55432}"
export EVM_PORT="${EVM_PORT:-18545}"
export API_PORT="${API_PORT:-41990}"
export WEB_PORT="${WEB_PORT:-51730}"
export WAREHOUSE_PORT="${WAREHOUSE_PORT:-47100}" # #51 Java data-platform sidecar

# #31 the docker compose project name (so `down` targets exactly our stack).
export COMPOSE_PROJECT="${COMPOSE_PROJECT:-pcl}"

# #31 repo root (this file is scripts/lib/ports.sh) + the gitignored pidfile dir.
PORTS_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export REPO_ROOT="$(cd "${PORTS_LIB_DIR}/../.." && pwd)"
export DEV_DIR="${REPO_ROOT}/.dev"

# #31 all 4 fixed ports as a list (stop.sh frees every one).
fixed_ports() {
  echo "${PG_PORT} ${EVM_PORT} ${API_PORT} ${WEB_PORT} ${WAREHOUSE_PORT}"
}

# #31 free a TCP port: kill -9 whatever listens on it (idempotent — no-op if nothing does).
free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    echo "  freeing port ${port} (pids: ${pids})"
    echo "${pids}" | xargs -r kill -9 2>/dev/null || true
  fi
}

# #31 record a background pid under .dev/<name>.pid for a later, targeted teardown.
write_pidfile() {
  local name="$1"
  local pid="$2"
  mkdir -p "${DEV_DIR}"
  echo "${pid}" > "${DEV_DIR}/${name}.pid"
}

# #31 kill a process recorded in .dev/<name>.pid (idempotent), then remove the pidfile.
kill_pidfile() {
  local name="$1"
  local file="${DEV_DIR}/${name}.pid"
  if [ -f "${file}" ]; then
    local pid
    pid="$(cat "${file}" 2>/dev/null || true)"
    if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
      kill -9 "${pid}" 2>/dev/null || true
    fi
    rm -f "${file}"
  fi
}

# #31 kill every recorded pidfile (used by the EXIT trap + stop.sh).
kill_all_pidfiles() {
  if [ -d "${DEV_DIR}" ]; then
    for file in "${DEV_DIR}"/*.pid; do
      [ -e "${file}" ] || continue
      kill_pidfile "$(basename "${file}" .pid)"
    done
  fi
}

# #31 bounded TCP health gate: poll until something accepts on the port, or fail after timeout.
wait_tcp() {
  local port="$1"
  local label="${2:-tcp:${port}}"
  local timeout="${3:-60}"
  local i=0
  until lsof -ti "tcp:${port}" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "${i}" -ge "${timeout}" ]; then
      echo "ERROR: ${label} never came up on port ${port} (waited ${timeout}s)" >&2
      return 1
    fi
    sleep 1
  done
}

# #31 bounded HTTP health gate: poll a URL until it returns 200, or fail after timeout.
wait_http() {
  local url="$1"
  local label="${2:-${url}}"
  local timeout="${3:-60}"
  local i=0
  until curl -fsS -o /dev/null "${url}" 2>/dev/null; do
    i=$((i + 1))
    if [ "${i}" -ge "${timeout}" ]; then
      echo "ERROR: ${label} health gate never passed at ${url} (waited ${timeout}s)" >&2
      return 1
    fi
    sleep 1
  done
}

# #31 bounded JSON-RPC health gate: poll eth_blockNumber until the node answers (no blind sleep).
wait_rpc() {
  local url="$1"
  local timeout="${2:-60}"
  local i=0
  until curl -fsS -X POST -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' "${url}" 2>/dev/null | grep -q '"result"'; do
    i=$((i + 1))
    if [ "${i}" -ge "${timeout}" ]; then
      echo "ERROR: local EVM node never answered eth_blockNumber at ${url} (waited ${timeout}s)" >&2
      return 1
    fi
    sleep 1
  done
}
