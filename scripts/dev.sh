#!/usr/bin/env bash
# The Seam · the idempotent, port-safe dev orchestrator (stop -> test -> start) · #31
# One command stands the whole stack up on the 4 fixed ports, re-runnable safely: STOP frees the
# ports + tears down stale services; TEST runs forge + bun and ABORTS on failure (--no-test skips);
# START brings up Postgres (compose), the local EVM node (anvil), deploys + seeds the world
# (Deploy.s.sol), then the indexer, API and web — each gated on a bounded health check, never a
# blind sleep — and prints a banner with the live URLs + seeded demo accounts. An ERR/INT/TERM trap
# tears the partial stack down so a failed or Ctrl-C'd start never leaves orphaned ports held; a
# clean start leaves the services running (detached) so the matrix verifier (#27) / a demo can use
# them. The verify gate reuses this to bring the stack up deterministically.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

# #31 flags: --no-test skips the forge+bun gate (fast restarts); --reset wipes the PG volume.
RUN_TESTS=1
for arg in "$@"; do
  case "${arg}" in
    --no-test) RUN_TESTS=0 ;;
    --reset) export DEV_RESET=1 ;;
    *) echo "unknown flag: ${arg}" >&2; exit 2 ;;
  esac
done

# #31 anvil's well-known account 0 — the deterministic deploy/admin/issuer signer locally. The
# same key drives the seed so the 6 identity addresses are stable run-to-run (the #28 landmine).
ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
LOCAL_RPC="http://127.0.0.1:${EVM_PORT}"
export LOCAL_RPC
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:${PG_PORT}/pcl}"

# #31 the partial-start teardown: on ERR/INT/TERM during startup, tear the stack back down so no
# orphaned process keeps a fixed port. Disarmed on a clean finish (services persist for the demo).
STARTED_OK=0
cleanup() {
  if [ "${STARTED_OK}" -eq 0 ]; then
    echo ""
    echo "[dev] startup interrupted — tearing down…"
    "${SCRIPT_DIR}/stop.sh" || true
  fi
}
trap cleanup EXIT INT TERM

mkdir -p "${DEV_DIR}"

# ── STOP (idempotent) ─────────────────────────────────────────────────────────
echo "[dev] STOP: freeing ports + clearing stale services…"
"${SCRIPT_DIR}/stop.sh"

# ── INFRA ──────────────────────────────────────────────────────────────────────
# #31 the off-chain test gate (bun run test) backfills the read model from the live anvil and runs
# against the verify-gate Postgres (db.helper.ts / api/test/helpers.ts), so the chain + db + the
# deploy/seed manifest (deployments/31337.json) must be UP *before* TEST — not after. Bring the
# infra up first; TEST then has its dependencies; START layers the app services on top.
echo "[dev] INFRA: postgres + anvil + deploy/seed (test + app dependencies)…"

# 1. Postgres (compose project pcl, fixed host port 55432).
echo "[dev]   postgres (docker compose -p ${COMPOSE_PROJECT})…"
docker compose -p "${COMPOSE_PROJECT}" -f "${REPO_ROOT}/docker-compose.yml" up -d
wait_tcp "${PG_PORT}" "postgres" 60
# also wait for the server to actually accept queries (container healthcheck).
i=0
until docker compose -p "${COMPOSE_PROJECT}" -f "${REPO_ROOT}/docker-compose.yml" exec -T postgres pg_isready -U postgres -d pcl >/dev/null 2>&1; do
  i=$((i + 1)); [ "${i}" -ge 60 ] && { echo "ERROR: postgres never became ready" >&2; exit 1; }; sleep 1
done

# 2. local EVM node (anvil) on 18545, deterministic chain id 31337.
echo "[dev]   anvil (local EVM node) on ${EVM_PORT}…"
( exec anvil --port "${EVM_PORT}" --chain-id 31337 --silent > "${DEV_DIR}/anvil.log" 2>&1 ) &
write_pidfile "anvil" "$!"
wait_rpc "${LOCAL_RPC}" 60

# 3. deploy + seed (Deploy.s.sol writes deployments/31337.json — the off-chain genesis manifest).
echo "[dev]   deploy + seed (Deploy.s.sol -> deployments/31337.json)…"
(cd "${REPO_ROOT}/contracts" && forge script script/Deploy.s.sol:Deploy \
  --rpc-url "${LOCAL_RPC}" --broadcast --private-key "${ANVIL_KEY}" --silent)

# ── TEST (abort start on failure; --no-test skips) ─────────────────────────────
# #31 runs against the INFRA above: forge (contracts) + bun (off-chain Vitest, incl. the integration
# suites that need the live anvil + verify-gate Postgres + the seeded manifest).
if [ "${RUN_TESTS}" -eq 1 ]; then
  echo "[dev] TEST: forge + bun (use --no-test to skip)…"
  (cd "${REPO_ROOT}/contracts" && forge test -vv)
  (cd "${REPO_ROOT}" && bun run test)
else
  echo "[dev] TEST: skipped (--no-test)."
fi

# ── START ──────────────────────────────────────────────────────────────────────
echo "[dev] START: bringing up the app services on fixed ports ${API_PORT}/${WEB_PORT}…"

# 4. indexer (migrates the read model on boot, backfills from the manifest, tails the live node).
# `exec` so the recorded pid IS the bun process (kill_pidfile targets it directly, no orphan).
echo "[dev]   indexer (read-model projection)…"
(cd "${REPO_ROOT}/indexer" && exec env DATABASE_URL="${DATABASE_URL}" LOCAL_RPC="${LOCAL_RPC}" bun run src/main.ts > "${DEV_DIR}/indexer.log" 2>&1) &
write_pidfile "indexer" "$!"

# 5. API (graphql-yoga + SSE on 41990; migrations are idempotent so a double-apply is a no-op).
echo "[dev]   api (graphql + sse) on ${API_PORT}…"
(cd "${REPO_ROOT}/api" && exec env DATABASE_URL="${DATABASE_URL}" LOCAL_RPC="${LOCAL_RPC}" API_PORT="${API_PORT}" bun run src/index.ts > "${DEV_DIR}/api.log" 2>&1) &
write_pidfile "api" "$!"
wait_http "http://localhost:${API_PORT}/health" "api" 60

# 6. web (Vite) on 51730.
echo "[dev]   web (vite) on ${WEB_PORT}…"
(cd "${REPO_ROOT}/web" && exec bun run dev > "${DEV_DIR}/web.log" 2>&1) &
write_pidfile "web" "$!"
wait_tcp "${WEB_PORT}" "web" 60

# ── BANNER ───────────────────────────────────────────────────────────────────
STARTED_OK=1
cat <<BANNER

  ──────────────────────────────────────────────────────────────────
   permissioned-credit-ledger · stack UP (local node)
  ──────────────────────────────────────────────────────────────────
   GraphQL API   http://localhost:${API_PORT}/graphql
   SSE feed      http://localhost:${API_PORT}/sse
   Health        http://localhost:${API_PORT}/health
   Web app       http://localhost:${WEB_PORT}
   Postgres      postgres://postgres:postgres@localhost:${PG_PORT}/pcl
   Local EVM     ${LOCAL_RPC}  (chain id 31337)

   Seeded demo accounts (anvil mnemonic-index 1..6):
     ACCREDITED_US_1  0x7099…79C8   verified · accredited · US
     ACCREDITED_US_2  0x3C44…93BC   verified · accredited · US
     REG_S_NONUS_1    0x90F7…b906   verified · Reg-S non-US
     REG_S_NONUS_2    0x15d3…6A65   verified · Reg-S non-US
     UNVERIFIED       0x9965…A4dc   not verified (row 3)
     FROZEN           0x976E…0aa9   verified · frozen   (row 4)

   Verify the matrix:  bun run scripts/verify_matrix.ts
   Tear it all down:   ./scripts/stop.sh
  ──────────────────────────────────────────────────────────────────

BANNER

# leave services running (detached) on a clean start; stop.sh / Ctrl-C tears them down.
exit 0
