# permissioned-credit-ledger

> A deterministic, permissioned tokenized-credit ledger whose core is an off-chain↔on-chain **reconciliation engine**: it proves, every cycle, that servicing cash and on-chain claimable balances agree — and **halts distribution** the moment they don't.

![off-chain ↔ on-chain reconciliation — the seam](docs/architecture/04-offchain-onchain-reconciliation.svg)

## The problem this solves

Tokenize a real-world loan and you are suddenly running **two ledgers in parallel** that inevitably drift apart:

- **off-chain** — the servicing system that tracks the actual cash collected from a borrower, and
- **on-chain** — the token that represents investors' claims on that cash.

Interest accrues on-chain on a fixed schedule; cash arrives off-chain on its own messy timetable; a fat-fingered NAV mark or a buggy distribution lets holders claim value the servicer never actually collected. **Drift is not a bug in any single component — it is an emergent property of running two ledgers that cannot natively communicate.** Left unchecked, it is exactly how tokenized-RWA systems silently become insolvent: the token keeps accruing obligations it can't honor, and the shortfall only surfaces when someone tries to withdraw.

You cannot fix this with a transaction. There is **no two-phase commit across Postgres and a blockchain** — they are separate systems with separate failure domains. So this codebase doesn't pretend they're atomic. It treats the chain as the single source of truth, the database as an eventually-consistent **projection** of it, and adds a reconciliation engine that **proves the projection still matches the chain — continuously — and fails closed when it can't.**

> **Reconciliation is a gate, not a report.** The conventional approach reconciles monthly and surfaces a dashboard; the window between reconciliations is a window of unknown exposure, and a restatement after the fact does not un-send a bad distribution. Here, reconciliation sits *in front of* every value-moving action. Distribution is gated on a passing proof, not on a calendar.

## How it works

A first-lien mortgage (CRE-first, residential-ready) is tokenized as an **ERC-3643-lite permissioned security token** on Avalanche. The stack is four layers:

| Layer | What it does | Where |
|---|---|---|
| **Permissioned token** | Every transfer routes through an on-chain compliance gauntlet (frozen → verified → eligible → accreditation/jurisdiction) and reverts a *typed* custom error. | `contracts/src/` — `CreditToken`, `IdentityRegistry`, `ComplianceRegistry` |
| **Accrual + NAV** | Interest accrues per holder; `claim()` pays from a reserve (checks-effects-interactions). NAV marks must clear an acceptance bound or trip a `NavAnomaly` freeze. | `contracts/src/CreditToken.sol`, `api/src/nav/` |
| **Indexer** | A viem reader streams `CreditToken` + `IdentityRegistry` events into Postgres read models, idempotently (`txHash:logIndex`), reorg-safe and resumable. | `indexer/src/` |
| **Reconciliation engine** | Every ~2s: reads both sides, evaluates four invariants, recomputes state via a deterministic replay, and **halts** on any mismatch. | `api/src/recon/`, `api/src/replay/` |

A **Pothos** code-first GraphQL API (with **SSE** live feeds) sits over the read models; a **React + Vite** app is the UI.

![component topology](docs/architecture/01-topology.svg)

### The two clocks

The system has two independent heartbeats, and the whole correctness story is about reconciling state across them. The **block clock** advances on-chain state every block (accrual grows, `claimable` ticks up, new events land). The **reconciliation clock** samples *both* sides every cycle and proves they still agree — or halts. The projection always lags the chain by an indexer cycle; the recon clock is what closes that gap provably, instead of pretending it isn't there.

![on-chain calls ↔ DB projection · the two heartbeats](docs/architecture/07-onchain-db-heartbeats.svg)

## The reconciliation engine (the core)

Each cycle, `runReconCycle` ([`api/src/recon/engine.ts`](api/src/recon/engine.ts)) loads a snapshot of both ledgers and evaluates four invariants in a fixed order, short-circuiting on the first failure so the recorded reason is deterministic:

| # | Invariant | Predicate | Breaks into |
|---|---|---|---|
| I1 | `SupplyBacked` | on-chain total supply == off-chain backed principal | `ReconMismatch` |
| I2 | `ClaimableCovered` | aggregate claimable ≤ off-chain collected cash (the solvency gate) | `ReconMismatch` |
| I3 | `NavInBounds` | no active loan sits under a NAV-anomaly halt | `NavAnomaly` |
| I4 | `IdentityValid` | every current holder is verified and not frozen | `ReconMismatch` |

A break writes a typed halt to `recon_status` and gates every payout (`assertCanDistribute` in [`api/src/recon/halt.ts`](api/src/recon/halt.ts)).

**Determinism is what makes the halt trustworthy.** The state fingerprint is not a hash of the live snapshot — it is `stateHash(replay(loadInputs))`, a *cold replay* of the canonical event log. So the live verdict and an independent audit recompute the same byte-exact state and the same halt. That equality is pinned by a property test ([`api/test/replay.interleaving.prop.test.ts`](api/test/replay.interleaving.prop.test.ts)): replaying the same events in **any interleaving** yields an identical `stateHash`. The halt isn't "the dashboard thinks we're insolvent" — it's a reproducible proof.

## Compliance, by construction

A non-compliant holder is **impossible, not just disallowed**. Every transfer enters `CreditToken._update`, which calls `ComplianceRegistry.checkTransfer` *before* any balance moves; the gauntlet reverts the first failing typed custom error. Identity (who a wallet is) lives in `IdentityRegistry`; the rules (per-offering Reg D / Reg S) live in `ComplianceRegistry` — so the same wallet can be eligible for one loan series and rejected by another.

![transfer lifecycle — the gauntlet](docs/architecture/03-transfer-lifecycle.svg)

Onboarding runs through a **KYC** flow: the document is hashed in the browser (only `{filename, size, sha256}` is sent — no bytes, no PII), a provider returns a verdict, and on approval the issuer signs `IdentityRegistry.setClaims`. From that point the wallet's on-chain claims drive every transfer. The off-chain layer surfaces the same eligibility by *simulating* a transfer and decoding the typed revert — so the UI shows the exact reason the chain would give, for free.

![KYC onboarding — verdict becomes an on-chain claim](docs/architecture/06-kyc-onboarding.svg)

## Quick start

Brings the whole stack up on fixed, non-default ports in about a minute.

**Prerequisites:** [Bun](https://bun.sh) · [Foundry](https://book.getfoundry.sh) (`forge` / `anvil`) · [Docker](https://docs.docker.com/get-docker/) (daemon running).

```bash
cp .env.example .env          # RPC URLs + DATABASE_URL (defaults target the local stack)
bun install                   # off-chain workspaces (shared/api/indexer/web/scripts)
bun run dev                   # one command: stop -> test -> start (idempotent, port-safe)
```

`bun run dev` frees the fixed ports, runs `forge test` + `bun run test`, starts Postgres (Docker) and a local anvil node, deploys + seeds the 6 identities and 6 loans, and launches the indexer, API, and web app — each gated on a health check. Use `--no-test` for fast restarts.

| Service | URL |
|---|---|
| Web app | http://localhost:51730 |
| GraphQL API | http://localhost:41990/graphql |
| SSE live feed | http://localhost:41990/sse |
| Local EVM (anvil) | http://127.0.0.1:18545 (chain id 31337) |
| Postgres | postgres://postgres:postgres@localhost:55432/pcl |

## The 10-scenario matrix

`scripts/verify_matrix.ts` drives all ten scenarios end-to-end through the real GraphQL surface and the reconciliation engine against the local node, asserting each typed outcome, then prints `10/10 scenarios passed.` plus an order-independence property over permutations.

```bash
bun run scripts/verify_matrix.ts     # expect: 10/10 scenarios passed.
```

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

Plus: issuance is capped at the loan's principal **on-chain** — `mint()` reverts `ExceedsPrincipal` rather than over-issuing — and a matured loan refuses new investment. The click-by-click walkthrough is in [`docs/DEMO.md`](docs/DEMO.md).

## Deliberately cut & mocked

The boundary is explicit, not accidental — full reasoning in [`docs/architecture/DESIGN.md`](docs/architecture/DESIGN.md):

- **Real fiat ramp + USDC** — the reserve is a `MockUSDC` contract; the servicer's collected cash is reported, not wired. The protocol layer above it is real; the cash-in/out is the mock.
- **ERC-3643-lite** — the transfer gauntlet, identity registry, and modular compliance are modeled and enforced. The full ONCHAINID claim-issuer machinery (a `TrustedIssuersRegistry`, signed verifiable claims) is named as the production drop-in, not built.
- **Custody** — the issuer is a single server signer. Production custody (MPC / multisig) is the seam, not implemented.
- **Borrow-against & tranche waterfall** — named Phase-2 modules, deliberately **not** built: you don't bolt a money market or a senior/junior waterfall onto a distribution core whose backing isn't yet continuously proven.
- **Auth / login** — out of scope entirely.

The litmus test the codebase holds itself to: if a design decision can't be justified without reference to a specific vendor's quirks, it doesn't belong at the protocol layer.

## Layout

```
permissioned-credit-ledger/
├── contracts/   # Foundry: IdentityRegistry, ComplianceRegistry, CreditToken, MockUSDC (+ fuzz/invariant tests)
├── indexer/     # viem indexer: chain events -> Postgres read models (idempotent, resumable)
├── api/         # Pothos GraphQL + graphql-yoga + SSE; recon/ engine + replay/ (the seam)
├── web/         # React 18 + Vite + Tailwind (wallet picker, invest/claim, Health panel)
├── db/migrations/   # raw SQL migrations (no ORM)
├── scripts/     # verify_matrix.ts, dev.sh, demo_reset.ts
└── docs/        # DEMO.md + architecture/ (DESIGN.md, MAP.md, 7 SVGs)
```

## Test suite

```bash
forge test -vv                       # Solidity unit + fuzz + invariant tests
bun run test                         # Vitest + fast-check (incl. the deterministic-replay property)
bun run scripts/verify_matrix.ts     # the 10-scenario integration suite — expect 10/10 scenarios passed.
bun run scripts/demo_reset.ts        # reset the local demo world to a known-good cold state (local node only)
```

Correctness is **typed and proven, not asserted**: Solidity custom errors + TypeScript discriminated unions (no stringly-typed failures), and the reconciliation halt is backed by an order-independence property over the event replay — the property that makes the whole ledger auditable.
