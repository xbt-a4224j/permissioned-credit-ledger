# permissioned-credit-ledger

[![CI](https://github.com/xbt-a4224j/permissioned-credit-ledger/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/xbt-a4224j/permissioned-credit-ledger/actions/workflows/ci.yml)

A permissioned tokenized-credit ledger. A CRE loan is originated off-chain, tokenized as a permissioned security token on Avalanche, and sold to verified investors. The core is an **off-chain↔on-chain reconciliation engine**: every cycle it proves servicing cash and on-chain claimable balances agree, and **halts distribution** when they don't.

![Reconciliation health: an out-of-bounds NAV mark trips the gate, the engine HALTS, and the NavInBounds invariant goes red while the other three stay green.](docs/screenshots/health-halt.png)

*The halt is the product. A +40% NAV mark fails the validation gate; accrual freezes on-chain and distribution stops until the invariant clears.*

![Loan marketplace: six seeded first-lien mortgage series with principal, net yield, LTV, DSCR and unsubscribed balance; verified investors invest against the permissioned token.](docs/screenshots/marketplace.png)

*Investor view. Each series is one permissioned token capped at the loan's principal on-chain; investing as an unverified wallet reverts `ReceiverNotVerified`.*

## The problem

Tokenizing a loan creates two ledgers that drift:

- **on-chain** — the token: investor claims, accrued interest, who holds what.
- **off-chain** — the servicer: actual cash collected from the borrower.

There is no two-phase commit across Postgres and a blockchain — separate systems, separate failure domains. So the chain is the single source of truth, the database is an eventually-consistent **projection** of it, and a reconciliation engine proves the projection still matches the chain — and fails closed when it can't.

> **Reconciliation is a gate, not a report.** It sits in front of every payout. Distribution is gated on a passing proof, not on a calendar.

## Architecture

```mermaid
flowchart LR
  WH["Warehouse sidecar (Java)<br/>~10k loan book, scoring"] -->|tokenize| API
  subgraph onchain["On-chain (Avalanche / anvil)"]
    CT["CreditToken (1 per loan)<br/>accrual · claim · _update gate"]
    IR["IdentityRegistry<br/>verified bool"]
    RES["MockUSDC reserve"]
  end
  API["GraphQL API (Pothos)<br/>+ SSE · recon engine"] -->|writeContract| onchain
  onchain -->|events| IDX["Indexer (viem)<br/>idempotent by txHash:logIndex"]
  IDX --> PG[("Postgres<br/>read models")]
  PG --> API
  API --> WEB["React + Vite UI"]
  API -. "recon: read both, halt on mismatch" .-> onchain
```

| Layer | What it does | Where |
|---|---|---|
| **Permissioned token** | Mint/transfer routes through `CreditToken._update`, which reverts `ReceiverNotVerified` if the recipient isn't verified on-chain. Issuance capped at `principalCap` (`ExceedsPrincipal`). | `contracts/src/CreditToken.sol`, `IdentityRegistry.sol` |
| **Accrual + NAV** | Interest accrues per holder; `claim()` pays from the reserve (checks-effects-interactions). An out-of-bounds NAV mark trips a `NavAnomaly` freeze. | `contracts/src/CreditToken.sol`, `api/src/nav/` |
| **Indexer** | viem reader → Postgres read models, idempotent (`txHash:logIndex`), resumable from a cursor. Watches the token set from the DB, so runtime-tokenized loans are picked up without a restart. | `indexer/src/` |
| **Reconciliation engine** | Every ~2s: snapshots both ledgers, checks four invariants, recomputes state via deterministic replay, and halts on mismatch. | `api/src/recon/` |

Stack: Solidity + Foundry · TypeScript on Bun · viem · Postgres (raw SQL, no ORM) · Pothos GraphQL + graphql-yoga + SSE · React/Vite · Java/Spring data sidecar.

## Loan lifecycle

```mermaid
flowchart LR
  O["Originate<br/>(warehouse book)"] --> T["Tokenize<br/>deploy CreditToken,<br/>fund reserve"]
  T --> I["Invest<br/>mint — gated on<br/>verified holder"]
  I --> A["Accrue<br/>on-chain, per holder"]
  A --> C["Claim<br/>pays from reserve"]
  A -.-> R["Reconcile<br/>gates every payout"]
  C -.-> R
```

## Reconciliation engine (the core)

Each cycle, `runReconCycle` ([`api/src/recon/engine.ts`](api/src/recon/engine.ts)) loads a snapshot of both ledgers and checks four invariants in fixed order (short-circuiting so the recorded reason is deterministic):

| # | Invariant | Predicate | Breaks into |
|---|---|---|---|
| I1 | `SupplyBacked` | on-chain total supply == off-chain backed principal | `ReconMismatch` |
| I2 | `ClaimableCovered` | aggregate claimable ≤ off-chain collected cash (solvency) | `ReconMismatch` |
| I3 | `NavInBounds` | no active loan under a NAV-anomaly halt | `NavAnomaly` |
| I4 | `IdentityValid` | every current holder is verified | `ReconMismatch` |

A break writes a typed halt to `recon_status` and gates every payout.

**Why the halt is trustworthy:** the state fingerprint is not a hash of the live snapshot — it's `stateHash(replay(inputs))`, a cold replay of the canonical event log. A property test ([`api/test/replay.interleaving.prop.test.ts`](api/test/replay.interleaving.prop.test.ts)) asserts that replaying the same events in **any interleaving** yields the identical `stateHash` (canonical order is `(blockNumber, logIndex)`). So the live verdict and an independent audit recompute byte-exact state. The halt is a reproducible proof, not a dashboard opinion.

### The two clocks

```mermaid
flowchart TD
  subgraph block["Block clock — every block"]
    B["on-chain state advances<br/>accrual grows, claimable ticks, events land"]
  end
  subgraph recon["Recon clock — every cycle"]
    RC["sample BOTH sides → prove they agree → halt if not"]
  end
  B --> IDXc["indexer projects (lags by one cycle)"]
  IDXc --> RC
  B --> RC
```

The projection always lags the chain by an indexer cycle. The recon clock is what closes that gap provably instead of pretending it's closed.

## Design notes (anticipating the obvious questions)

- **Is accrued interest stored on-chain?** No — it's computed. The contract stores the inputs (`balance`, `ratePerSecond`, a per-holder `{accrued, lastAccruedAt}` checkpoint); `claimable()` is a `view` that returns `accrued + balance·rate·elapsed/SCALE`. The stored `accrued` is only written on a settle event (transfer, claim, status change). Ticking a number every second would be gas-suicide.
- **Why a local node *and* Fuji?** All correctness (the matrix, every property/invariant test) runs against a deterministic local anvil node. Fuji is the live-demo target only — public RPCs are flaky, so nothing asserts correctness against them.
- **Why is the DB allowed to lag?** Because you can't transact across Postgres and a chain. The DB is a projection; the recon engine is what makes "is it still correct?" answerable instead of assumed.
- **How are runtime-tokenized loans indexed?** The indexer's watched-token set comes from the `loans` table, not a static deploy manifest. A 3s refresh loop picks up a newly tokenized loan, backfills its history from block 0, and re-subscribes — no restart.
- **Why verified-only, not full ERC-3643?** The interesting part is the *mechanism* — compliance enforced in `_update`, by construction, so a non-verified holder is impossible rather than disallowed. Per-offering claim machinery (jurisdiction/accreditation, a `TrustedIssuersRegistry`) is the named production drop-in, not built.
- **Reserve accounting:** the reserve is an append-only `reserve_ledger` (every credit/debit is an entry); the balance recon reads is a maintained running-sum cache, not a mutable field.

## Quick start

**Prerequisites:** [Bun](https://bun.sh) · [Foundry](https://book.getfoundry.sh) (`forge`/`anvil`) · [Docker](https://docs.docker.com/get-docker/) (daemon running).

```bash
cp .env.example .env
bun install
bun run dev          # stop -> test -> start (idempotent, port-safe). --no-test for fast restarts.
```

`bun run dev` frees the fixed ports, runs the tests, starts Postgres (Docker) + a local anvil node, deploys + seeds 3 identities and 6 loans, and launches the warehouse, indexer, API, and web app — each gated on a health check.

| Service | Port | Runtime | URL | Role |
|---|---|---|---|---|
| Web app | 51730 | Vite / React | <http://localhost:51730> | the UI |
| GraphQL API + SSE | 41990 | Bun / graphql-yoga | <http://localhost:41990/graphql> · <http://localhost:41990/sse> | API + recon engine — the only client-facing data surface |
| Warehouse (data sidecar) | 47100 | Java / Spring (Tomcat) | <http://localhost:47100/book> · <http://localhost:47100/actuator/health> | origination book + scoring — **proxied by the API, not called from the browser** |
| Local EVM (anvil) | 18545 | anvil | <http://127.0.0.1:18545> | the chain (id 31337) |
| Postgres | 55432 | Docker | `postgres://postgres:postgres@localhost:55432/pcl` | read models |

The browser only ever talks to **51730** (UI) and **41990** (GraphQL). The API reaches the warehouse (**47100**) and the chain (**18545**) server-side; Postgres (**55432**) is internal. So there is one client-facing data surface — GraphQL — in front of three back-end systems.

## The scenario matrix

`scripts/verify_matrix.ts` drives seven scenarios end-to-end through the real GraphQL surface and the recon engine against the local node, each against its own fresh fixture, then asserts an order-independence property over replay permutations.

```bash
bun run scripts/verify_matrix.ts     # expect: 7/7 scenarios passed.
```

| # | Scenario | Expected |
|---|---|---|
| 1 | verified invest (loan 1) | OK — `PositionOpened`, accrual starts |
| 2 | verified invest (loan 3) | OK — `PositionOpened` |
| 3 | unverified invest | revert `ReceiverNotVerified` |
| 4 | claim, reserve funded | OK — `InterestClaimed`, reserve debited |
| 5 | claim, reserve underfunded | revert `InsufficientReserve` |
| 6 | NAV feed +40% out-of-bounds | HALT `NavAnomaly`, accrual frozen |
| 7 | inject servicing cash below claimable | HALT distribution `ReconMismatch` |
| P | `replay(events)` over any interleaving | identical `stateHash` |

The click-by-click walkthrough is in [`docs/DEMO.md`](docs/DEMO.md).

## Deliberately cut & mocked

Full reasoning in [`docs/architecture/DESIGN.md`](docs/architecture/DESIGN.md):

- **Real fiat + USDC** — the reserve is `MockUSDC`; collected cash is reported, not wired.
- **Full ERC-3643 compliance** — identity is a single verified bool; the per-offering claim machinery is the named drop-in.
- **Custody** — a single server signer; production MPC/multisig is the seam.
- **Borrow-against & tranche waterfall** — named Phase-2 modules, not built: you don't bolt a money market onto a distribution core whose backing isn't yet continuously proven.
- **Auth/login** — out of scope.

## Layout

```
permissioned-credit-ledger/
├── contracts/       # Foundry: IdentityRegistry, CreditToken, MockUSDC (+ fuzz/invariant tests)
├── indexer/         # viem indexer: chain events -> Postgres (idempotent, resumable, DB-sourced token set)
├── api/             # Pothos GraphQL + yoga + SSE; recon/ engine + replay (the seam)
├── web/             # React 18 + Vite + Tailwind (marketplace, positions, origination, health)
├── warehouse/       # Java/Spring data sidecar: the ~10k-loan origination book + scoring
├── db/migrations/   # raw SQL migrations (no ORM)
├── scripts/         # verify_matrix.ts, dev.sh, demo_reset.ts
└── docs/            # DEMO.md + architecture/ (DESIGN.md + reconciliation diagram)
```

## Tests

```bash
forge test -vv                       # Solidity unit + fuzz + invariant
bun run test                         # Vitest + fast-check (incl. the deterministic-replay property)
bun run scripts/verify_matrix.ts     # the 7-scenario integration suite
```

Correctness is typed, not stringly-typed (Solidity custom errors + TS discriminated unions), and the reconciliation halt is backed by an order-independence property over the event replay.
