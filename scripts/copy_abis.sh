#!/usr/bin/env bash
# Single-source-of-truth ABI export (contracts -> off-chain) · #13
# Copies the Foundry build artifacts for the on-chain layer (CreditToken + the identity /
# compliance registries) out of contracts/out into the indexer and the API. The indexer
# (#16) decodes CreditToken events and the GraphQL resolvers (#21) encode txs against these
# ABIs; copying the COMPILED artifact (not a hand-kept copy) is what stops ABI drift — the
# landmine where a stale ABI silently mis-parses events or turns a typed revert opaque.
# We copy the FULL artifact (abi + bytecode), so viem/the API can read either uniformly.
set -euo pipefail

# #13 resolve the repo root from this script's own location (works from any CWD).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT="${REPO_ROOT}/contracts/out"

# #13 the on-chain layer contracts the off-chain layer binds to.
CONTRACTS=(CreditToken IdentityRegistry ComplianceRegistry)

# #13 both consumers get their own copy under src/abi/.
DESTS=("${REPO_ROOT}/indexer/src/abi" "${REPO_ROOT}/api/src/abi")

for dest in "${DESTS[@]}"; do
    mkdir -p "${dest}"
done

for contract in "${CONTRACTS[@]}"; do
    artifact="${OUT}/${contract}.sol/${contract}.json"
    # #13 hard-fail with a clear remedy if the build artifact is missing (acceptance 4):
    # the export is meaningless without a fresh compile.
    if [[ ! -f "${artifact}" ]]; then
        echo "error: missing artifact ${artifact} — run 'forge build' in contracts/ first" >&2
        exit 1
    fi
    for dest in "${DESTS[@]}"; do
        cp "${artifact}" "${dest}/${contract}.json"
        echo "copied ${contract}.json -> ${dest}/${contract}.json"
    done
done
