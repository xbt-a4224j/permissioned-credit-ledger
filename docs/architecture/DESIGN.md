<!-- The Seam · design decisions + what-was-cut + recon-HALT philosophy · #29 -->

# Design

## What this is

A deterministic, permissioned tokenized-credit ledger. A loan is a first-lien mortgage on a property (CRE-first, residential-ready); investors hold claims on its cash flows through an ERC-3643-lite permissioned security token. The marquee is an off-chain↔on-chain **reconciliation engine** that continuously proves servicing cash and on-chain claimable balances agree — and **halts distribution** the moment they don't. Reconciliation is a *gate in front of* value movement, not a report after it. The system is company-neutral by construction: it models the problem (proving a tokenized loan is still backed), not any one vendor's product.

## Architecture

Three layers and a seam — *one machine, three layers*. The on-chain layer holds the permissioned token and its registries; the asset layer is the loan/mortgage domain model and its read models in Postgres; the money layer (in `api/`) moves the two tokens (cash leg + security token); and the seam (`api/recon/`) is the reconciliation engine that straddles all three.

```
                 ┌──────────────────────────────────────────────┐
   CLIENT        │  web (React + Vite)  marketplace · dashboard  │
                 │                       invest/claim · recon    │
                 └───────────────┬───────────────▲──────────────┘
                  GraphQL request │               │ SSE live feed
                 ┌───────────────▼───────────────┴──────────────┐
   OFF-CHAIN     │  api (Pothos GraphQL + yoga + SSE)            │
   (TS on Bun)   │  indexer (viem) ──► Postgres read models      │
                 │  nav-gate ──► reconciliation-engine ★         │
                 │              (4 invariants · replay · HALT)   │
                 └───────┬───────────────────────▲──────────────┘
        tx: invest/      │                       │ emit events
        transfer/claim   │                       │ (orange/async)
                 ┌───────▼───────────────────────┴──────────────┐
   ON-CHAIN      │  IdentityRegistry  ComplianceRegistry         │
   (Avalanche    │  CreditToken (ERC-3643-lite, _update gauntlet,│
   Fuji / local) │   accrual · claim CEI)        MockUSDC reserve│
                 └──────────────────────────────────────────────┘
```

The architecture is drawn in four diagrams under `docs/architecture/`:

- [`01-topology.svg`](./01-topology.svg) — system topology: Fuji C-Chain + local node → viem indexer → Postgres read models → Pothos/yoga GraphQL + SSE → React/Vite; the server signer and the NAV feed ingest.
- [`02-eligibility-boundaries.svg`](./02-eligibility-boundaries.svg) — eligibility / trust topology: which actor is trusted for what (issuer role vs holder vs server signer), `IdentityRegistry` and `ComplianceRegistry`, and the `CreditToken._update` transfer gauntlet (freeze → verified → compliance).
- [`03-transfer-lifecycle.svg`](./03-transfer-lifecycle.svg) — the invest → accrue → claim runtime sequence: typed revert OR balance mutation + event → indexer projection → read model → SSE.
- [`04-offchain-onchain-reconciliation.svg`](./04-offchain-onchain-reconciliation.svg) — the seam: servicing cash + NAV vs on-chain claimable + supply → deterministic replay → `stateHash` → the 4 invariants → OK or HALT.

## Key decisions and trade-offs

**(a) ERC-3643-lite permissioned token, not full ERC-3643 / ERC-1400.** The thesis is the reconciliation seam, not a standards-complete token. We keep the load-bearing ERC-3643 idea — every transfer routes through an on-chain compliance check via the OpenZeppelin v5 `_update` hook — and an `IdentityRegistry` + `ComplianceRegistry` pair, but drop the full ONCHAINID/claim-issuer/trusted-issuers-registry machinery and ERC-1400 partitions/document/controller surface. Single loan per token, no tranching. The trade-off: not drop-in interoperable with a production ERC-3643 stack, but small enough that the gauntlet and its five typed reverts are auditable at a glance.

**(b) Typed reason codes — Solidity custom errors + TS discriminated unions, never strings.** Every failure is a machine-checkable code, mirrored on both sides of the boundary so a revert decoded off-chain keeps its identity. The five transfer/claim reason codes are `NotEligible`, `ReceiverFrozen`, `ReceiverNotVerified`, `AccreditationRequired`, `InsufficientReserve`. The two engine halt states are `NavAnomaly` and `ReconMismatch`. Stringly-typed errors would make the gauntlet untestable by code and the UI's reason-code badges unreliable; selectors are kept in sync from a single source-of-truth ABI so a stale selector can't turn a typed revert into an opaque one.

**(c) Deterministic event-replay + `stateHash()` as the integrity primitive.** The engine folds the ordered event log (`chainEvents` + `nav`) into expected per-holder claimable balances and a single `stateHash`. Canonical ordering is derived from `(blockNumber, logIndex)`, so **any arrival interleaving of the same events reduces to the same `stateHash`**. Interleaving-independence matters because the indexer is asynchronous and resumable: reorgs, restarts, and double-ingests must not change the answer to "are we still solvent?". That equality is the headline fast-check property test (#19) — determinism is asserted as a property over permutations, not a single happy path.

**(d) Hybrid real-chain: Avalanche Fuji for the real deploy, a local node for deterministic CI.** Public Fuji RPCs rate-limit, time out, and lag, so correctness is *never* asserted against Fuji. The 10-scenario matrix and every property/invariant test run against a local anvil node (chain id 31337) brought up by `scripts/dev.sh`. Fuji is the live-demo target only: retry with backoff, pin a confirmations depth, keep the indexer resumable. The demo is live but the tests aren't flaky.

**(e) Server-signed txs; identities seeded; no auth/login.** The six demo identities (2 accredited-US, 2 Reg-S non-US, 1 unverified, 1 frozen) are seeded by `Deploy.s.sol` with stable addresses run-to-run, and a single server signer submits txs on their behalf. This keeps the demo reproducible and the surface focused on the seam; the cost is no real onboarding and a single key with no HSM/KMS — both documented as cut/gap below. There is no auth layer anywhere by design.

**(f) Raw SQL migrations, no ORM.** Postgres holds read models projected by the indexer; migrations are hand-written SQL applied idempotently on boot. No ORM means the projection and reconciliation read exactly the columns they index by `(blockNumber, logIndex)`, with no hidden query behavior between the engine and ground truth — the engine stays a pure folder over data it can see in full.

## The recon-HALT philosophy

Reconciliation here is **fail-closed**, not fail-open. A halted-but-correct ledger beats a live-but-drifting one: refusing to pay is always recoverable; paying out value that isn't there is not. So the engine sits *in front of* every value-moving action — the claim path calls `assertCanDistribute()` before it moves any reserve value, and a failed cycle throws a typed `DistributionHalted` carrying the engine state. No best-effort, no partial pay. The boundary is the product.

Each reconciliation cycle evaluates **four invariants in a fixed order** (so the recorded failed invariant is deterministic), short-circuiting on the first failure:

1. **I1 — SupplyBacked.** On-chain total supply equals the off-chain backed principal. A drift means the projection and the chain disagree on how much token exists. → `ReconMismatch`.
2. **I2 — ClaimableCovered.** Aggregate on-chain claimable must be ≤ off-chain cash collected (the solvency gate). If holders could claim more than the servicer collected, the system would pay money that isn't there. → `ReconMismatch`.
3. **I3 — NavInBounds.** Every active loan's latest accepted NAV mark is non-anomalous; a loan under a NAV halt must not drive distribution. → `NavAnomaly`.
4. **I4 — IdentityValid.** Every current holder is verified and not frozen — an identity break the gauntlet should never have allowed. → `ReconMismatch`.

What HALT actually stops: **distribution / claim**. Reads, indexing, and the UI keep working; only the value-moving path is gated.

`NavAnomaly` (matrix row 9) vs `ReconMismatch` (matrix row 10): **`NavAnomaly`** is a bad *input* — a NAV mark jumps out of the acceptance bound (e.g. a +40% spike). The on-chain NAV gate refuses the mark and freezes accrual; off-chain, invariant I3 trips and the engine state is `NavAnomaly`. The same bound is enforced identically on-chain (the L2 gate) and off-chain (the L3 validation gate) so the two never reconcile to different claimable. **`ReconMismatch`** is a *books-disagree* condition — injected servicing cash ≠ aggregate claimable (row 10 breaks I2), or supply/identity drift (I1/I4). The distinction is bad-mark-frozen-accrual versus the-ledger-doesn't-balance; both halt distribution, but they name different failures so the operator knows whether to fix a feed or investigate the projection.

## What was cut

Cut deliberately so the boundary is explicit, not accidental. Each line is the production story that would replace the demo stub:

- **Real fiat ramp + real USDC** — the reserve is a `MockUSDC` contract. *Production:* a custody/settlement rail with a real USDC reserve and an on/off-ramp at the edges, funding the cash leg of DvP instead of a mock.
- **Account-abstraction onboarding** — identities are seeded by `Deploy.s.sol`, not self-registered. *Production:* AA wallets with a KYC/KYB onboarding flow writing verified claims into `IdentityRegistry`.
- **Secondary market / ATS matching** — no order book; transfers are direct. *Production:* an ATS/order-book matching engine settling secondary trades atomically through the same transfer gauntlet.
- **Multi-tranche securitization** — single loan, single class per token. *Production:* a capital-stack with senior/mezz/junior tranches and a sub-participation wrapper, each tranche its own claim priority.
- **Auth / login** — no auth layer anywhere; the server signer acts for seeded identities. *Production:* real authn/authz with per-identity wallets and role-scoped issuer powers behind an HSM/KMS.

Residential consumer-law gating (TILA / RESPA / ability-to-repay) is a *named-but-cut* extension point on `ComplianceRegistry`: the platform is built mortgage-general and seeded CRE-first (5 CRE + 1 residential), so residential plugs into the same rails — but the consumer-law rules themselves are not built here.

## Production gaps

Priority-ordered — what a production hardening pass tackles first:

1. **No static analysis in CI.** No Slither / Mythril pass on the contracts; CI runs `forge test` (unit + fuzz + invariant) but not automated vulnerability scanning. First add.
2. **Mock reserve, not a real custody/settlement rail.** `MockUSDC` stands in for a funded reserve; there is no real custody, no DvP against real cash, no reconciliation against a bank ledger.
3. **Single server signer, no HSM/KMS.** One key signs every tx with no hardware isolation, rotation, or quorum. A production deploy needs key management and role separation.
4. **NAV feed is a seeded source, not a real adapter.** Marks come from a seeded feed, not a servicer/oracle adapter with provenance and signature checks; the acceptance bound is the only defense and must be tuned against real mark volatility.

## Verification

- **Contracts:** `forge test -vv` — unit + fuzz + invariant tests, including the reserve/claim conservation invariant and the NAV-bound fuzz test.
- **Off-chain:** `bun run test` (Vitest + fast-check), including the **deterministic-replay property** (#19): replaying the same `chainEvents` + `nav` over any interleaving yields an identical `stateHash`, and the reconciliation-invariant property tests.
- **End-to-end:** `bun run scripts/verify_matrix.ts` (#27) — the 10-scenario integration suite against the local node + Postgres, printing `10/10 scenarios passed.` plus the order-independence property over permutations.

See [`DEMO.md`](../DEMO.md) for the click-by-click live walkthrough and [`../../README.md`](../../README.md) for the quickstart.
