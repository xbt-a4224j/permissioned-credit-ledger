# permissioned-credit-ledger

A deterministic, permissioned tokenized-credit ledger built around an off-chain↔on-chain **reconciliation engine** that proves servicing cash and on-chain claimable balances always agree — and **halts distribution** the moment they don't.

![off-chain ↔ on-chain reconciliation — the seam](docs/architecture/04-offchain-onchain-reconciliation.svg)

## What it is

A first-lien mortgage (CRE-first, residential-ready) is tokenized as an **ERC-3643-lite permissioned security token** on Avalanche: an `IdentityRegistry` + `ComplianceRegistry` gate every transfer through an on-chain gauntlet, and interest accrues per holder with a claim path backed by a reserve. A **viem indexer** streams `CreditToken` events into **Postgres** read models that feed a **Pothos** code-first GraphQL API (with SSE live feeds) and a **React + Vite** app. The core is the **reconciliation engine**: a deterministic event-replay recomputes ledger state and four invariants compare off-chain servicing cash against on-chain claimable — any mismatch raises a typed `NavAnomaly` / `ReconMismatch` and **fails closed**, stopping distribution rather than paying out value that isn't there. Determinism is the property that makes the halt trustworthy: the same events in any interleaving produce an identical `stateHash`.

Read as a **platform**: a *shared compliant-securities core* (KYC/identity · compliance · custody · indexer · distribution · reconciliation) with *pluggable asset modules* on top (CRE single-loan, residential, and a deferred borrow-against money-market module). Onboarding runs through a **KYC** flow whose provider is mocked behind an interface — the verdict becomes an on-chain claim the gauntlet enforces. See [`docs/architecture/DESIGN.md`](docs/architecture/DESIGN.md) for the shared-core-vs-module map, the build-vs-buy decisions, the recon-HALT philosophy, and what was deliberately cut.

## Architecture

Who does what in the business, and which component serves it — a borrower's loan flows through an off-chain servicer into a permissioned token, reconciled against the servicer's books before any payout reaches investors:

![business architecture — actors mapped to system components](docs/architecture/05-business-architecture.svg)

The runtime topology — a permissioned token on Avalanche, a viem indexer, the reconciliation engine, and a typed GraphQL API behind the app:

![component topology](docs/architecture/01-topology.svg)

How an on-chain call becomes a DB read model, and the **two heartbeats** that drive correctness — the block clock advances on-chain state every block, the reconciliation clock samples both sides every cycle and proves they still agree (or halts). The chain is the single authority; Postgres is a projection of it, so you prove eventual consistency rather than pretending to 2-phase-commit a blockchain:

![on-chain calls ↔ DB projection · the two heartbeats](docs/architecture/07-onchain-db-heartbeats.svg)

## Compliance & onboarding

Compliance is enforced **by construction**. A new investor onboards through **KYC**: the document is hashed in the browser (only `{filename, size, sha256}` is sent — no PII or bytes are stored), a provider — *mocked behind an interface; swap it for Persona / Parallel Markets* — returns a verdict, and on approval the issuer signs `IdentityRegistry.setClaims`. From that point the wallet's claims drive every transfer.

![KYC onboarding — verdict becomes an on-chain claim](docs/architecture/06-kyc-onboarding.svg)

Every transfer then routes through the on-chain **gauntlet** — frozen → verified → eligible → offering gate (Reg D accreditation / Reg S jurisdiction) — reverting the *first* failing typed error. These are machine-checkable reason codes, never stringly-typed failures:

![transfer lifecycle — the gauntlet](docs/architecture/03-transfer-lifecycle.svg)

The trust boundaries that make it hold — who may hold what, and where each check lives:

![eligibility & trust boundaries](docs/architecture/02-eligibility-boundaries.svg)

## Quick start

Brings the whole stack up on fixed, non-default ports in about a minute.

**Prerequisites:** [Bun](https://bun.sh) · [Foundry](https://book.getfoundry.sh) (`forge` / `anvil`) · [Docker](https://docs.docker.com/get-docker/) (daemon running).

```bash
cp .env.example .env          # RPC URLs + DATABASE_URL (defaults target the local stack)
bun install                   # off-chain workspaces (shared/api/indexer/web/scripts)

# 60-second path: one command stands the whole stack up (stop -> test -> start),
# idempotent + port-safe — re-runnable safely.
bun run dev
```

`bun run dev` (see [`scripts/dev.sh`](scripts/dev.sh), #31) frees the fixed ports, runs `forge test` + `bun run test`, then starts Postgres (Docker), the local EVM node (anvil), deploys [`script/Deploy.s.sol`](contracts/script/Deploy.s.sol) and seeds the 6 identities + 6 loans, and launches the indexer, API, and web app — each gated on a bounded health check. It prints a banner with the live URLs and seeded demo accounts. Use `bun run dev --no-test` for fast restarts.

| Service | URL |
|---|---|
| Web app (Vite) | http://localhost:51730 |
| GraphQL API | http://localhost:41990/graphql |
| SSE live feed | http://localhost:41990/sse |
| Local EVM (anvil) | http://127.0.0.1:18545 (chain id 31337) |
| Postgres | postgres://postgres:postgres@localhost:55432/pcl |

If you prefer the manual path, the equivalent steps are:

```bash
anvil --port 18545 --chain-id 31337                                  # local node
docker compose -p pcl up -d                                          # Postgres on 55432
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:18545 --broadcast   # deploy + seed
# (the indexer applies db/migrations/ on boot)
bun --filter '@pcl/api' dev   # GraphQL + SSE on 41990
bun --filter '@pcl/web' dev   # React app on 51730
```

Then run the scenario matrix against the running local node:

```bash
bun run scripts/verify_matrix.ts     # expect: 10/10 scenarios passed.
```

## Run the 10 scenarios

`scripts/verify_matrix.ts` (#27) drives all ten CLAUDE.md scenario rows end-to-end through the real GraphQL surface and the reconciliation engine against the **local node**, asserting each typed outcome, and prints the literal `10/10 scenarios passed.` plus an order-independence property over permutations.

| # | Scenario | Expected |
|---|---|---|
| 1 | accredited-US invest | OK — `PositionOpened` |
| 2 | Reg-S non-US invest | OK |
| 3 | unverified invest | revert `ReceiverNotVerified` |
| 4 | frozen holder initiates transfer | revert `SenderFrozen` |
| 5 | US holder on a Reg-S offering | revert `NotEligible` |
| 6 | US non-accredited holds Reg-D token | revert `AccreditationRequired` |
| 7 | claim, reserve funded | OK — `InterestClaimed`, reserve debited |
| 8 | claim, reserve underfunded | revert `InsufficientReserve` |
| 9 | NAV feed +40% out-of-bounds | HALT `NavAnomaly`, accrual frozen |
| 10 | inject servicing cash below claimable | HALT distribution `ReconMismatch` |

Beyond the matrix, the app also demonstrates **KYC onboarding** (an unverified wallet → upload + verdict → on-chain claim → invest now succeeds). The click-by-click walkthrough is in [`docs/DEMO.md`](docs/DEMO.md).

## Layout

```
permissioned-credit-ledger/
├── contracts/              # Foundry project (ERC-3643-lite permissioned token)
│   ├── src/                #   IdentityRegistry, ComplianceRegistry, CreditToken, MockUSDC
│   ├── test/               #   forge unit + fuzz + invariant tests
│   └── script/             #   Deploy.s.sol + identity/loan seeding
├── indexer/                # viem indexer: CreditToken events -> Postgres read models
├── api/                    # Pothos GraphQL + graphql-yoga + SSE; recon/ engine (the seam)
├── web/                    # React 18 + Vite + Tailwind app (wallet connect; invest/claim)
├── db/
│   └── migrations/         # raw SQL migrations (no ORM)
├── scripts/                # verify_matrix.ts, dev.sh, demo_reset.ts
└── docs/
    ├── DEMO.md             # the click-by-click live walkthrough
    └── architecture/       # DESIGN.md · MAP.md · 7 architecture SVGs (01–07)
```

## Test suite

```bash
forge test -vv                       # Solidity unit + fuzz + invariant tests
bun run test                         # Vitest + fast-check (incl. the deterministic-replay property, #19)
bun run scripts/verify_matrix.ts     # the 10-scenario integration suite (#27) — expect 10/10 scenarios passed.
```

The deterministic-replay **property** test (`api/test/replay.interleaving.prop.test.ts`, #19) asserts that replaying the same `chainEvents` + `nav` over any interleaving yields an identical `stateHash` — the property that makes the halt, and the whole ledger, auditable.

To reset the local demo world to a known-good cold state (wipe + redeploy + reseed, < 30s):

```bash
bun run scripts/demo_reset.ts        # local node only; refuses any non-local RPC
```
