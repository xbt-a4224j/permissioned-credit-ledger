# permissioned-credit-ledger

A deterministic, permissioned tokenized-credit ledger whose marquee feature is an off-chain↔on-chain **reconciliation engine** that proves servicing cash and on-chain claimable balances always agree — and **halts** the moment they don't.

## Why this exists

When a real-world credit asset (a loan) is tokenized, two ledgers run in parallel: the **off-chain** servicing system that tracks actual cash collected from a borrower, and the **on-chain** token that represents investors' claims on that cash. These two sources of truth drift. Interest accrues on-chain on a schedule; cash arrives off-chain on its own messy timetable; NAV marks move; a fat-fingered feed or a buggy distribution can let token holders claim value that the servicer never actually collected. In production, that drift is how tokenized-RWA systems either silently insolvent themselves or pay out money that isn't there.

The hard, interesting part of tokenized credit is **not** minting a token. It's *continuously proving the token is still backed* — and refusing to distribute when it can't be proven. This repo isolates that problem and builds the smallest honest system that solves it end to end: permissioned issuance, on-chain accrual, an off-chain indexer/reconciler, and a deterministic replay that makes "are we still solvent?" a question with a single, reproducible, byte-exact answer.

## Thesis

**Reconciliation is a gate, not a report.** Most systems reconcile *after* the fact and surface a dashboard. Here, reconciliation sits *in front of* every value-moving action: a NAV validation gate bounds accrual, and a deterministic event-replay recomputes expected claimable balances from the full event history. If recomputed state disagrees with on-chain state — or if injected servicing cash ≠ aggregate claimable — the engine emits a typed `ReconMismatch` / `NavAnomaly` and **halts distribution**. Correctness is enforced by construction (typed reason codes, not strings) and *proven* by a property test: replaying the same set of chain events + NAV updates in **any interleaving** must yield an **identical `stateHash`**. Determinism is the feature; the halt is the product.

## Layers

### L1 — Permissioned token (Avalanche)
An **ERC-3643-lite** permissioned security token on the Avalanche **Fuji C-Chain** testnet (local anvil/avalanche node for deterministic tests + CI).
- `IdentityRegistry` — who is verified, their jurisdiction (US-accredited / Reg-S non-US), frozen flag.
- `ComplianceRegistry` — transfer-eligibility rules (accreditation, Reg-D/Reg-S gating, freeze).
- `CreditToken` — the security token itself; every transfer routes through compliance via the OpenZeppelin v5 **`_update`** hook. Transfers that fail compliance revert with a **typed custom error** (`SenderFrozen`, `ReceiverFrozen`, `ReceiverNotVerified`, `NotEligible`, `AccreditationRequired`). Freeze = complete lockout: a frozen holder cannot send or receive tokens.
- Single loan per token (no tranching).

### L2 — Accrual + NAV feed
On-chain interest **accrual** against each position plus a **NAV feed** that marks the loan.
- Accrual accumulates claimable interest per holder over time; `claim()` pays from a **mock reserve**, debits the reserve, and resets accrued. Underfunded reserve reverts `InsufficientReserve`.
- The NAV feed pushes marks **bounded** by an acceptance gate (off-chain, in the L3 engine). An out-of-bounds mark (e.g. a +40% jump) does **not** silently update — it trips `NavAnomaly`, calls `freezeAccrual()` on-chain, and halts distribution. The bound constant is shared between the on-chain freeze hook and the off-chain gate so both sides always agree.

### L3 — Reconciliation engine + replay (the marquee)
Off-chain TypeScript (Bun). A **viem indexer** reads `CreditToken` events from Fuji (and the local node) into Postgres read models. The **reconciliation engine** then:
1. **NAV validation gate** — independently re-checks every NAV mark against bounds before it's allowed to drive distribution.
2. **Deterministic event-replay** — folds the ordered event log (`chainEvents` + `nav`) into expected per-holder claimable balances and a single `stateHash`.
3. **Reconciliation invariants** (4) — I1 `SupplyBacked`: on-chain total supply equals off-chain backed principal; I2 `ClaimableCovered`: aggregate claimable ≤ off-chain collected cash (solvency gate); I3 `NavInBounds`: no active loan is under a `NavAnomaly` halt; I4 `IdentityValid`: every current holder is verified and not frozen.
4. **Halt** — any violation emits a typed `ReconMismatch` / `NavAnomaly` and stops distribution. No best-effort, no partial pay.

The replay is **pure and order-independent over interleavings**: the canonical ordering is derived from `(blockNumber, logIndex)`, so any arrival order of the same events reduces to the same `stateHash`. That equality is the headline property test.

## Scope caps

| Dimension | Cap |
|---|---|
| Loans | 6 |
| Identities | 6 — 2 US-accredited, 2 Reg-S non-US, 1 unverified, 1 frozen |
| Reason codes | 6 (`SenderFrozen`, `NotEligible`, `ReceiverFrozen`, `ReceiverNotVerified`, `AccreditationRequired`, `InsufficientReserve`) + 2 engine states (`NavAnomaly`, `ReconMismatch`) |
| Reconciliation invariants | 4 |
| React app | 1 app, ≤ 4 views |
| Scenario matrix | 10 scenarios + 1 replay property |

## Scenario matrix

The integration suite (`scripts/verify_matrix.ts`) runs every row against the **local node**.

| # | Scenario | Expected outcome |
|---|---|---|
| 1 | Accredited-US invest | OK — `PositionOpened`, accrual starts |
| 2 | Reg-S non-US invest | OK |
| 3 | Unverified invest | revert `ReceiverNotVerified` |
| 4 | Frozen holder initiates transfer | revert `SenderFrozen` |
| 5 | Transfer to unverified receiver | revert `ReceiverNotVerified` |
| 6 | US non-accredited holds Reg-D token | revert `AccreditationRequired` |
| 7 | Claim, reserve funded | OK — `InterestClaimed`, reserve debited, accrued reset |
| 8 | Claim, reserve underfunded | revert `InsufficientReserve` |
| 9 | NAV feed pushes +40% out-of-bounds | HALT `NavAnomaly`, accrual frozen |
| 10 | Inject servicing cash below claimable | HALT distribution `ReconMismatch` |
| P | Property: `replay(chainEvents + nav)` over any interleaving | identical `stateHash` |

## Stack

| Layer | Choice |
|---|---|
| Contracts | Solidity + **Foundry** (forge/anvil), OpenZeppelin **v5** (`_update` hook) |
| Chain | **Avalanche Fuji** C-Chain testnet + local node (anvil / avalanche-local) for deterministic tests & CI |
| Contract tests | forge unit + **fuzz** + **invariant** tests |
| Runtime | **TypeScript on Bun** |
| Indexer | **viem** event reader → Postgres |
| Database | **Postgres**, **raw SQL** migrations (no ORM) |
| API | **GraphQL** via **Pothos** (code-first) + **graphql-yoga**; **SSE** live feeds |
| UI | **React 18** + **Vite** + **Tailwind**; wallet connect; invest/claim send Fuji txs |
| TS tests | **Vitest** + **fast-check** (property tests; deterministic replay is a property test) |

## Repo layout

```
permissioned-credit-ledger/
├── contracts/                 # Foundry project
│   ├── src/                   # IdentityRegistry, ComplianceRegistry, CreditToken, accrual/claim, NAV
│   ├── test/                  # forge unit + fuzz + invariant tests
│   └── script/                # deploy + seed scripts (Fuji + local)
├── indexer/                   # viem event reader → Postgres read models
├── api/                       # Pothos + graphql-yoga GraphQL, SSE feeds
├── web/                       # React 18 + Vite + Tailwind (≤ 4 views)
├── db/
│   └── migrations/            # raw SQL migrations (no ORM)
├── scripts/                   # verify_matrix.ts (10-scenario integration), tooling
└── docs/
    └── architecture/          # DESIGN.md, decision records, what's-cut
```

## Build order

Each block ships its own tests **inside the ticket**. Interfaces/ABIs land before implementations. Numeric acceptance criteria throughout.

1. **Foundation & interfaces.** Foundry + Bun workspaces, Postgres + raw-SQL migration runner, local node + CI wiring. Land all Solidity **interfaces and custom errors** and the TS **reason-code discriminated union** first — zero implementations. *Delivers:* a green skeleton CI, typed error surface, `docs/architecture/DESIGN.md` with what's-cut.
2. **Identity + Compliance.** `IdentityRegistry` + `ComplianceRegistry` with the 6 seeded identities and Reg-D/Reg-S/accreditation/freeze rules. *Delivers:* compliance unit + fuzz tests covering scenarios 3–6 reverts.
3. **CreditToken + permissioned transfers.** Security token wiring compliance through the `_update` hook; mint/invest path. *Delivers:* scenarios 1–6 green at the contract level; `PositionOpened` emitted.
4. **Accrual + claim + reserve.** Per-position accrual, `claim()` against the mock reserve, accrued reset, `InsufficientReserve`. *Delivers:* scenarios 7–8; forge **invariant** test on reserve/claim conservation.
5. **NAV feed + bounds gate.** On-chain NAV marks with the acceptance bound; out-of-bounds trips `NavAnomaly` and freezes accrual. *Delivers:* scenario 9; bound fuzz test.
6. **Indexer + read models.** viem reader → Postgres, **idempotent** by `EventId = txHash:logIndex`, reorg-safe, resumable from a stored cursor. *Delivers:* event tables populated deterministically from the local node; idempotency test (double-ingest is a no-op).
7. **Reconciliation engine + replay.** Pure folder over ordered events → per-holder claimable + `stateHash`; the 4 invariants; halt on violation. *Delivers:* scenario 10 (`ReconMismatch`) and the **fast-check property**: any interleaving → identical `stateHash`.
8. **API + Web + matrix.** Pothos/yoga GraphQL + SSE; React app (≤ 4 views) with wallet connect and invest/claim against Fuji; `scripts/verify_matrix.ts` runs all 10 scenarios + property against the local node. *Delivers:* full 10-scenario matrix green end to end; UI surfaces halts with typed reason codes.

## What's deliberately cut

Documented in `docs/architecture/DESIGN.md` so the boundary is explicit, not accidental:
- **Real fiat ramp + real USDC** — reserve is mocked.
- **Account-abstraction onboarding** — identities are seeded; a **KYC onboarding flow** (mock provider → on-chain claim) is added in Phase 2 (#39).
- **Secondary market / ATS matching** — no order book.
- **On-chain multi-tranche securitization** — the token stays single-class; the waterfall is **modeled off-chain** (pure + tested) and visualized as the documented next module (Phase 2 #38), not enforced on-chain.
- **Auth / login** — out of scope entirely; no auth layer anywhere.

## Senior signals to hit

- **Correctness is typed and enforced by construction.** Solidity custom errors + TS discriminated unions — never stringly-typed failures. Every revert and every halt has a machine-checkable reason code.
- **Determinism is provable, not asserted.** The replay equality is a *property* test over interleavings, not a single happy-path assertion.
- **The boundary is the product.** Reconciliation gates value movement; the system **halts** rather than degrading or paying best-effort.
- **Interfaces before implementations.** ABIs/interfaces and the reason-code union exist before any logic — consumers can be written against contracts that can't lie.
- **Tests ship with the feature.** No "tests later" ticket; every block lands forge/Vitest/fast-check coverage with numeric acceptance criteria.
- **Real chain, reproducible CI.** Deploys to Fuji *and* runs the full matrix deterministically against a local node, so the demo is live but the tests aren't flaky.
- **Honest scope.** What's cut is written down and defended, not hand-waved.

## Landmines

- **Fuji RPC flakiness.** Public Fuji RPCs rate-limit, time out, and lag. *Never* assert correctness against Fuji — the 10-scenario matrix and all property/invariant tests run against the **local node**. Treat Fuji as the live-demo target only: retry with backoff, pin a confirmations depth, and make the indexer resumable so a dropped connection is recoverable, not corrupting.
- **ABI drift.** The indexer, API, and web all decode `CreditToken` events; if the ABI diverges from the deployed bytecode, decoding silently mis-parses. Generate types from a **single source-of-truth ABI** emitted by the Foundry build, and fail CI on any ABI/typing mismatch. Custom-error selectors must stay in sync too — a stale selector turns a typed revert into an opaque one.
- **Indexer idempotency.** Re-ingesting the same block (reorg, restart, replay) must be a **no-op**. Key every event row by `EventId = txHash:logIndex`; upsert, don't insert. (Replay ordering uses `(blockNumber, logIndex)` — a separate concern from the dedup key.) A non-idempotent indexer double-counts accrual and silently breaks reconciliation — the bug then *looks* like a `ReconMismatch` in the engine, masking its true cause.
- **Reentrancy on `claim`.** `claim()` moves reserve value and resets accrued — classic reentrancy surface. Apply **checks-effects-interactions**: reset accrued and debit the reserve **before** any external transfer, and add an invariant test asserting total claimed never exceeds total accrued-minus-reserve, even under adversarial call ordering.
- **NAV bounds.** The bound is load-bearing — too loose and a bad mark slips through to drive distribution; too tight and legitimate marks trip a false `NavAnomaly`. The bound must be enforced **identically** on-chain (L2 gate) and off-chain (L3 validation gate); if they disagree, the chain and the engine reconcile to different claimable and you get a spurious halt. Pin the bound as a single shared constant and test both sides against the same fixtures.

## Mortgage-general by design

A position is a first-lien **mortgage** on a `Property`, not an abstract credit line. `collateralType ∈ {CRE, RESIDENTIAL}` is the seam: the platform is built mortgage-general and seeded CRE-first (5 CRE + 1 residential), so residential plugs into the same rails. Residential-specific consumer-law gating (TILA / RESPA / ability-to-repay) is a named **extension point** on the ComplianceRegistry — **deliberately cut** here (see DESIGN.md), not built.

## Build standards (every ticket inherits these)

- **Tests ship with the feature.** No feature ticket is done without its tests — forge tests for contracts incl. ≥1 fuzz/invariant; Vitest + fast-check off-chain incl. the deterministic-replay property. Acceptance criteria state numeric counts.
- **Optimize for simplicity & readability.** Small pure functions, explicit types, the boring solution. Fewer abstractions; no cleverness a reviewer must decode. Delete before you add.
- **Comments cite the issue #.** Every non-trivial file/function carries a short comment naming the issue it implements and why — e.g. `// #18 reconciliation invariant I2: claimable <= collected`. Any line should trace back to its ticket.
- **Enterprise / bank-grade UI** (see #24): institutional, calm, data-dense; tabular numerics for money; no crypto-gradient styling; clean empty/loading/error states; every view demoable on seeded data.
- **Everything is demoable.** No feature without a path to show it — from the UI or `scripts/verify_matrix.ts`. If it can't be demoed, it's out of scope.
- **The README lands** (see #30): value prop, hero diagram, a working 60-second quickstart, the 10-scenario script.
- **Idempotent, port-safe dev** (see #31): `bun run dev` stops conflicting processes, runs tests, then starts the whole stack on fixed non-default ports — re-runnable safely.

## Ports (fixed, non-conflicting — override via .env)

| Service | Port |
|---|---|
| Postgres | 55432 |
| Local EVM node (anvil) | 18545 |
| GraphQL API (Bun) | 41990 |
| Web (Vite) | 51730 |

Chosen to avoid common dev ports (3000 / 5173 / 5432 / 8545 / 8080). `scripts/dev.sh` frees these before starting.

## Phase 2 — round-2 demo modules

Round-2 extends the shared core with *pluggable asset/feature modules*, framed as the build-vs-buy /
integration thesis. The v1 **≤4-view cap is deliberately relaxed** (the app now adds *Loans*, *Tranches*).
See [`docs/phase-2-plan.md`](docs/phase-2-plan.md), [`docs/architecture/INTEGRATION.md`](docs/architecture/INTEGRATION.md)
(the shared-core-vs-module map + keep-vs-cut log), and [`docs/DEMO.md`](docs/DEMO.md) (the product walkthrough).

- **#38 — Tranche waterfall visualizer** (done): a pure, tested off-chain waterfall engine + animated visualizer. On-chain multi-class stays cut; this *models* the structuring module.
- **#39 — KYC onboarding** (done): a mock `KycProvider` behind an interface → verdict issuer-signs `IdentityRegistry.setClaims`. Build-vs-buy made literal; no PII stored (client-side hash, metadata only).
- **#42 — Platform-architecture panel** (done): one artifact showing the shared core + pluggable modules + the ranked take-rate stack, so the infrastructure thesis is *visible*.
- **#40/#41 — Borrow-against** (deferred, deliberately): the keystone money-market (pledge token → borrow USDC → LTV/liquidation). Depends on NAV/reconciliation integrity being proven first — building it on an unproven core would be the over-build trap, so it stays Phase 2.
