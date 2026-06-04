Wrote a complete, company-neutral README.md to **/Users/daj/dev/git/permissioned-credit-ledger/README.md** (123 lines). The project had not been scaffolded yet, so I created the repo root directory at the conventional `/Users/daj/dev/git/` location and placed the README there.

Neutrality verified mechanically: grep for `profitr|republic|iborrow|interview|job descript|JD|candidate|hiring|recruit` returned zero matches.

The README contains every requested section:
- **Project name + one-line thesis** — "Permissioned Credit Ledger" with a bolded thesis line about the off-chain↔on-chain reconciliation engine proving servicing cash and claimable balances agree and halting on mismatch.
- **CI badge placeholder** — a shields.io "CI: pending" badge at the top linking to `#`.
- **Why** — frames the central problem as silent drift between off-chain truth (servicer cash, NAV, accrued interest) and on-chain claim, and explains the engine as a NAV validation gate + deterministic event-replay with a trustworthy halt.
- **Quickstart** — prereqs (Bun, Foundry, Postgres) then numbered steps: (1) install via `bun install` / `forge install`, (2) start local node (`anvil`) + Postgres + `db:migrate`, (3) deploy contracts via `forge script script/Deploy.s.sol` to both local and Fuji, (4) run indexer/api/web dev servers, (5) run `bun run scripts/verify_matrix.ts`. Also includes `forge test` + `bun run test`.
- **Layout** — fenced tree matching the spec's repo layout (contracts/ with src|test|script, indexer/, api/, web/, db/migrations/, scripts/, docs/architecture/).
- **How it works** — one paragraph tying together the ERC-3643-lite CreditToken + IdentityRegistry/ComplianceRegistry gating, the five typed reason codes (Solidity custom errors mirrored as a TS discriminated union), viem indexer → Postgres read models → Pothos/yoga GraphQL + SSE → React app, and the reconciliation engine (NavAnomaly gate + deterministic replay → ReconMismatch halt + identical-state-hash property test under any interleaving).

Full markdown content:

---

# Permissioned Credit Ledger

[![CI](https://img.shields.io/badge/CI-pending-lightgrey.svg)](#)

**A deterministic, permissioned tokenized-credit ledger whose off-chain↔on-chain reconciliation engine proves that servicing cash and claimable balances always agree — and halts the moment they don't.**

---

## Why

Tokenizing private credit is easy to demo and hard to trust. The risk isn't minting a token — it's the silent drift between the **off-chain truth** (servicer cash, NAV marks, accrued interest) and the **on-chain claim** (what a holder can actually withdraw). When those two diverge, a naive system keeps paying out against money that isn't there.

This project treats that divergence as the central problem. A permissioned [ERC-3643](https://www.erc3643.org/)-lite security token enforces *who* may hold and transfer, and a **reconciliation engine** enforces *that the books agree* before any value moves. The engine is a NAV validation gate plus a deterministic event-replay: it recomputes ledger state from the raw chain events and the NAV feed, and if off-chain servicing cash does not equal on-chain claimable balances — or if a NAV update jumps out of bounds — it **halts** instead of distributing. Determinism is the property that makes the halt trustworthy: replaying the same events in any interleaving yields an identical state hash.

The result is a small, auditable system you can reason about end to end: typed reason codes instead of opaque string errors, interfaces and ABIs defined before implementations, and tests that ship inside each feature.

---

## Quickstart

### Prerequisites

- [**Bun**](https://bun.sh) (off-chain runtime: indexer, API, web, scripts)
- [**Foundry**](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`, `cast` — contracts, tests, local node)
- **PostgreSQL 15+** (indexer read models)

```bash
bun --version
forge --version
psql --version
```

### 1. Install

```bash
git clone <repo-url> permissioned-credit-ledger
cd permissioned-credit-ledger

bun install          # installs off-chain workspaces (indexer/, api/, web/, scripts/)
forge install        # installs Solidity dependencies (OpenZeppelin v5, forge-std)
cp .env.example .env # fill in RPC URL, deployer key, DATABASE_URL
```

### 2. Start the local node + Postgres

Use a deterministic local chain for development and the scenario matrix.

```bash
# Terminal A — local EVM node
anvil

# Postgres (example via Docker; any local Postgres works)
docker run --name pcl-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15

# Apply raw-SQL migrations
bun run db:migrate
```

### 3. Deploy the contracts

Deploys the permissioned token suite (`IdentityRegistry` + `ComplianceRegistry` + `CreditToken` + accrual/claim) and seeds the six identities and six loans.

```bash
# Local node
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Avalanche Fuji C-Chain testnet (uses values from .env)
forge script script/Deploy.s.sol --rpc-url $FUJI_RPC_URL --broadcast
```

### 4. Run the indexer, API, and web app

```bash
# Terminal B — viem indexer: reads CreditToken events into Postgres read models
bun run indexer:dev

# Terminal C — GraphQL API (Pothos + graphql-yoga) with SSE live feeds
bun run api:dev

# Terminal D — React + Vite + Tailwind UI (wallet connect; invest/claim send txs)
bun run web:dev
```

### 5. Run the scenario matrix

The 10-scenario integration suite drives the deployed contracts against the **local node** and asserts each typed outcome.

```bash
bun run scripts/verify_matrix.ts
```

### Run the test suites

```bash
forge test                     # Solidity unit + fuzz + invariant tests
bun run test                   # Vitest + fast-check (incl. deterministic-replay property test)
```

---

## Repository Layout

```
permissioned-credit-ledger/
├── contracts/              # Foundry project (ERC-3643-lite permissioned token)
│   ├── src/                #   IdentityRegistry, ComplianceRegistry, CreditToken, accrual/claim
│   ├── test/               #   forge unit, fuzz, and invariant tests
│   └── script/             #   Deploy.s.sol + identity/loan seeding
├── indexer/                # viem indexer: Fuji + local node events -> Postgres read models
├── api/                    # GraphQL (Pothos code-first + graphql-yoga) + SSE live feeds
├── web/                    # React 18 + Vite + Tailwind app (<= 4 views, wallet connect)
├── db/
│   └── migrations/         # raw SQL migrations (no ORM)
├── scripts/                # verify_matrix.ts and operational scripts
└── docs/
    └── architecture/       # DESIGN.md and architecture notes
```

---

## How It Works

A permissioned, ERC-3643-lite `CreditToken` represents claims on a single private-credit loan; an `IdentityRegistry` and `ComplianceRegistry` gate every mint and transfer so that only verified, jurisdiction- and accreditation-eligible wallets can hold it — rejections surface as **typed reason codes** (`NotEligible`, `ReceiverFrozen`, `ReceiverNotVerified`, `AccreditationRequired`, `InsufficientReserve`) implemented as Solidity custom errors and mirrored as a TypeScript discriminated union. Interest accrues on-chain and is withdrawn through a claim path backed by a reserve. A [viem](https://viem.sh) indexer streams `CreditToken` events from the chain into Postgres read models that feed a code-first GraphQL API and live SSE feeds, which the React app renders alongside wallet-driven invest and claim transactions. The keystone is the **reconciliation engine**: a NAV validation gate flags out-of-bounds marks (`NavAnomaly`) and freezes accrual, while a deterministic event-replay recomputes ledger state from the ordered chain events plus the NAV feed and compares injected off-chain servicing cash against on-chain claimable balances — any mismatch raises `ReconMismatch` and halts distribution rather than paying out against funds that don't exist. Because replay is deterministic, the same events in **any interleaving** produce an identical state hash, which a fast-check property test asserts and which is what makes the halt — and the whole ledger — auditable.
