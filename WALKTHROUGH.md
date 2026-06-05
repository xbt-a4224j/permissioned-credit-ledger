# Permissioned Credit Ledger — Product Walkthrough

> A speaking guide for presenting this system from a **product** point of view: what customer pain it removes, why each engineering decision is actually a product decision, and how to demo it. Written to demonstrate depth *and* customer obsession — every technical choice below traces back to a person who gets hurt if we get it wrong.

---

## 1. The one-sentence pitch

**When you tokenize a real loan, two sets of books run in parallel — the servicer's cash and the on-chain claim — and they drift. This system makes "are we still backed?" a question with one byte-exact answer, and *refuses to pay out the moment the answer is no.***

Everything else is in service of that sentence. If you only remember one thing to say in the room: **reconciliation here is a gate, not a report.** Most RWA systems reconcile after the fact and render a dashboard. We put reconciliation *in front of* every value-moving action and **halt** instead of degrading.

---

## 2. Who the customer is (and what job they're hiring us for)

This is not a "crypto" product. The buyers are institutional, and they each have a different job-to-be-done. Speaking to all four shows you understand the *market*, not just the code.

| Persona | The job they're hiring us for | What "failure" looks like to them | Where we serve it |
|---|---|---|---|
| **Issuer / originator** (tokenizes a loan book) | "Let me raise against my loans without a 2 a.m. call that we paid out money we never collected." | A buggy distribution silently makes the vehicle insolvent. | The HALT gate in `api/src/resolvers/mutations.ts` refuses to broadcast a distribution while reconciliation is broken. |
| **Investor** (accredited-US or Reg-S non-US) | "Prove my token is still backed by real cash — continuously, not in a quarterly PDF." | They're holding a claim on money that isn't there. | The 4 reconciliation invariants (`api/src/recon/invariants.ts`), surfaced live over SSE. |
| **Compliance officer** | "Only eligible wallets ever hold this, and every rejection has a reason I can defend to a regulator." | A frozen or unverified holder ends up on the cap table. | Typed custom errors through the `_update` chokepoint + the `IdentityValid` invariant as a backstop. |
| **Auditor / fund admin** | "Give me a reproducible, defensible number — same inputs, same answer, every time." | The reconciliation is non-deterministic, so it can't be relied on. | Deterministic replay → a single `stateHash`, proven order-independent by a property test. |

The seam that makes this one product instead of four: **a single typed reason code vocabulary** spans the whole stack (5 on-chain custom errors + 2 engine HALT states), so the compliance officer's "why was this rejected" and the investor's "why did distribution stop" are the *same machine-checkable answer*, end to end.

---

## 3. The product thesis, said three ways

Pick the framing that matches your audience.

- **For an operator:** "We'd rather stop paying than pay wrong. The system halts on uncertainty — no best-effort, no partial pay."
- **For an engineer:** "Correctness is enforced by construction (typed reason codes, not strings) and *proven* by a property test, not asserted by a happy-path case."
- **For a risk officer:** "There are two independent gates in front of money: a NAV bound that won't let a bad mark drive accrual, and a replay that recomputes expected claimable from raw events and compares it to reality. Either one trips and distribution stops."

---

## 4. The architecture as a customer story

Three layers, told as the journey of a single dollar of interest from "loan performs" to "investor claims."

```
  Asset Layer (L1/L2 · on-chain, Solidity)        Money/Seam Layer (L3 · off-chain, TS/Bun)
  ┌───────────────────────────────┐               ┌──────────────────────────────────────┐
  │ IdentityRegistry              │   viem        │ Indexer → Postgres read models        │
  │ ComplianceRegistry  ──gauntlet│──events──────▶ │ (idempotent by (blockNumber,logIndex))│
  │ CreditToken (_update hook)    │               │            │                           │
  │   • accrual                   │               │            ▼                           │
  │   • claim() ← reserve         │               │ NAV validation gate (bound parity)    │
  │   • NAV freeze                │               │            │                           │
  └───────────────────────────────┘               │            ▼                           │
                                                  │ Reconciliation engine (4 invariants)  │
                                                  │   → deterministic replay → stateHash  │
                                                  │   → HALT on break                     │
                                                  └───────────┬──────────────────────────┘
                                                              │ GraphQL + SSE
                                                              ▼
                                                  React app (≤4 views) · invest / claim / health
```

### L1 — "Only the right people hold it" (permissioned token)
An ERC-3643-lite security token. Every transfer routes through one chokepoint — the OpenZeppelin v5 `_update` hook in `contracts/src/CreditToken.sol`. That's a **product** decision: there is exactly *one* place a non-compliant transfer can be stopped, so there's exactly one place to audit. The compliance gauntlet (`contracts/src/ComplianceRegistry.sol`) runs in a fixed, observable precedence order:

> frozen receiver → unverified receiver → not eligible → offering rule (Reg-D accreditation / Reg-S non-US)

Each branch reverts a *typed* error (`ReceiverFrozen`, `ReceiverNotVerified`, `NotEligible`, `AccreditationRequired`). The order is deliberate and tested — "freeze beats verification beats eligibility" — because a compliance officer needs the *most specific true reason*, not whichever check happened to run first.

### L2 — "Interest is earned honestly" (accrual + NAV gate)
Interest accrues per holder on-chain. Two details that are pure customer-trust decisions:

- **A halt preserves earned interest but never accrues over the gap.** When a loan defaults or NAV freezes, `accrualEndsAt` stamps the instant; interest before it is preserved lazily for every holder, interest after it is excluded — *without* eagerly settling everyone (gas). The resumed-loan path folds the halted span into `haltedElapsed` so a holder left unsettled across a whole halt still skips the gap. Translation for the room: *"we don't pay interest for the period a loan wasn't performing, and we don't make you claim just to lock in what you already earned."*
- **`claim()` is reentrancy-safe by construction** (`CreditToken.sol:171`) — checks-effects-interactions *plus* a guard: reset accrued and check the reserve **before** the external transfer. This is the classic place RWA systems get drained. We treat it as load-bearing, with a forge invariant test asserting total claimed never exceeds what's owed even under adversarial call ordering.

The **NAV bound** (`api/src/nav/bounds.ts`) is the first of two HALT mechanisms. A mark that jumps more than ±20% (`maxJumpBps: 2000`), is stale (>1h), or arrives out of timestamp order is *refused* — it never enters the accepted feed — and trips `NavAnomaly`, freezing accrual. The bound is one shared constant enforced **identically on-chain and off-chain**; if they disagreed, the chain and the engine would reconcile to different claimable and you'd get a *spurious* halt. (That's the landmine we designed around — see §8.)

### L3 — The marquee: reconciliation as a gate
This is what you spend the most time on. The engine (`api/src/recon/engine.ts`) loads a snapshot and evaluates **4 invariants in a fixed order**, short-circuiting on the first break (`api/src/recon/invariants.ts`):

| # | Invariant | The plain-English promise | Trips when |
|---|---|---|---|
| **I1** | `SupplyBacked` | On-chain token supply == off-chain backed principal | The indexer's projection and the chain disagree on how much token exists |
| **I2** | `ClaimableCovered` | Aggregate claimable ≤ servicer cash actually collected | **The solvency gate** — holders could claim more than was collected |
| **I3** | `NavInBounds` | No active loan is under a NAV anomaly | A bad mark is driving distribution |
| **I4** | `IdentityValid` | Every holder is verified and not frozen | A non-compliant holder reached the cap table |

A break emits a typed engine state — `NavAnomaly` (I3) or `ReconMismatch` (everything else) — writes a `recon_status` row, and sets a **distribution-halt flag**. The mutation resolver reads that flag **first, before touching the chain** (`mutations.ts:48`), so a broken book *cannot* broadcast a distribution. Gating after broadcast would be a dashboard; gating before is the product.

---

## 5. Why determinism is the feature (the part that wins technical respect)

An auditor can't trust a number they can't reproduce. So the reconciliation state isn't computed ad hoc — it's a **pure fold** over the ordered event log into a single `stateHash` (`api/src/replay/fold.ts`, `hash.ts`).

The canonical ordering is derived from `(blockNumber, logIndex)` for chain events and `(observedAt, source)` for NAV, so **any arrival order of the same events reduces to the same hash.** That equality is the headline property test (`api/test/replay.interleaving.prop.test.ts`): fast-check shuffles the inputs into arbitrary interleavings and asserts an identical `stateHash` every time.

Three things kill determinism, and we close all three explicitly (`hash.ts:3`): JSON key order (every object key + map entry is sorted), bigint serialization (every money value routes through one stringifier, never the default thrower), and Map iteration order. And the replay reducer is **pure** — no wall-clock, no RNG; the clock is *injected* — because a stray `Date.now()` would break the property only in CI, intermittently, which is the worst possible failure mode.

The closing move that ties it together: the *live* engine's `stateHash` is itself a **cold replay of the same DB inputs** (`engine.ts:39`). So the production reconciliation row and an independent auditor's replay share one fingerprint — *live and replay provably agree.* That's the sentence that lands with a risk officer.

> **Say this:** "Determinism is the feature. The halt is the product. We can prove the halt is correct because the same events in any order give the same answer — and that's a property test over thousands of interleavings, not a single happy path."

---

## 6. Customer obsession in the details

Use these to show the product was built for *people using it under stress*, not for a demo-day screenshot.

- **Optimistic positions.** On invest, the UI shows the position *before* the indexer catches up (`mutations.ts` + `tx/reconcile.ts`), then reconciles to the canonical row. The investor isn't left staring at a spinner wondering if their money moved.
- **Live, not polled.** Reconciliation status pushes over SSE via Postgres `LISTEN/NOTIFY` (`api/src/sse/sources.ts`) — a HALT reaches the screen the instant the engine commits it, with a low-frequency poll as a dropped-listener backstop. A halt you find out about 30 seconds late is a halt that already paid out.
- **The accrual ticker is display-only.** It never writes back; on-chain accrued and the recon engine stay authoritative. We refuse to let a cosmetic number become a source of truth.
- **Mortgage attributes institutions actually price on.** Loans carry LTV and DSCR in basis points (`Identities.sol`), surfaced in the API, with a per-loan data room URI. The seed isn't toy data — it's a 6-loan tape (5 CRE + 1 residential) with a *performing*, a *delinquent*, and a *defaulted* loan so the demo shows real lifecycle, not just the happy case.
- **Honest empty/loading/error states are a requirement, not an afterthought** (per the build standards): the genesis read model reports OK-by-construction rather than throwing on an empty database.

---

## 7. The demo script (the 10-scenario matrix, told as a narrative)

The integration suite (`scripts/verify_matrix.ts`) runs every row against a deterministic **local node** — never against flaky public Fuji. Walk the room through it as a story in three acts.

**Act 1 — "The right people, and only them" (compliance):**
1. Accredited-US invests → OK, `PositionOpened`, accrual starts.
2. Reg-S non-US invests → OK.
3. Unverified invests → revert `NotEligible`.
4. Transfer to a frozen receiver → revert `ReceiverFrozen`.
5. Transfer to an unverified receiver → revert `ReceiverNotVerified`.
6. US non-accredited tries to hold a Reg-D token → revert `AccreditationRequired`.

**Act 2 — "Money moves honestly" (accrual + reserve):**
7. Claim with the reserve funded → OK, `InterestClaimed`, reserve debited, accrued reset.
8. Claim with the reserve underfunded → revert `InsufficientReserve`.

**Act 3 — "And we stop the moment we can't prove it" (the marquee):**
9. NAV feed pushes a +40% out-of-bounds mark → **HALT `NavAnomaly`**, accrual frozen.
10. Inject servicing cash < claimable → **HALT `ReconMismatch`**, distribution blocked.

**The encore — the property:** replay the chain events + NAV in any interleaving → **identical `stateHash`.**

The emotional arc to narrate: acts 1–2 are table stakes any token can do; **act 3 is the whole product** — the system choosing to stop rather than pay wrong, and then *proving* the stop was justified.

---

## 8. The hard questions — and your answers

Anticipating these is how you demonstrate depth.

- **"Isn't halting just downtime? That's bad UX."** No — halting is the *correct* UX for a solvency system. The alternative is paying out money that isn't there. The halt is scoped to *distribution*; reads, accrual display, and the health panel keep working so an operator can see *why* and act.
- **"What stops the indexer from double-counting on a restart or reorg?"** Every event row is keyed and upserted by `(blockNumber, logIndex)` — re-ingesting a block is a no-op. A non-idempotent indexer would double-count accrual and surface as a *fake* `ReconMismatch`, masking the real cause. We treat idempotency as a correctness invariant, with a property test (`indexer/test/ingest.idempotency.prop.test.ts`).
- **"How do you know the on-chain and off-chain NAV bounds agree?"** They're a single shared constant, tested against the same fixtures on both sides. If they diverged, the chain and engine would reconcile to different claimable — a spurious halt — so the parity *is* the test.
- **"What if the ABI drifts from the deployed bytecode?"** A single source-of-truth ABI is emitted by the Foundry build and copied to consumers (`scripts/copy_abis.sh`), with a CI consistency check (`indexer/test/abi.consistency.test.ts`). A stale custom-error selector would turn a typed revert into an opaque one — so selectors are in scope too.
- **"Why no auth?"** Deliberately cut. The product question is *backing and eligibility*, not login. Identities are seeded, not self-registered. Saying what you *didn't* build, and why, is the senior signal.

---

## 9. What's deliberately cut (judgment, not gaps)

Naming the boundary is a customer-obsession move: it's the difference between "we ran out of time" and "we focused on the one problem that matters." All documented in `docs/architecture/DESIGN.md`:

- **Real fiat ramp / real USDC** — the reserve is mocked. The reconciliation logic is identical against real cash.
- **Account-abstraction onboarding** — identities are seeded, not self-registered.
- **Secondary market / ATS matching** — no order book.
- **Multi-tranche securitization** — single loan, single class.
- **Residential consumer-law gating** (TILA / RESPA / ability-to-repay) — a *named extension point* on the ComplianceRegistry, intentionally not built. The platform is mortgage-general by design (`collateralType ∈ {CRE, RESIDENTIAL}` is the seam), seeded CRE-first so residential plugs into the same rails.

---

## 10. Current build state (so you never overclaim)

Speak to this honestly — it reads as integrity, and integrity is the whole brand of a reconciliation product.

- **Done & tested:** the contract suite (Identity/Compliance/CreditToken/accrual/claim/NAV) with forge unit + fuzz + invariant tests; the indexer with idempotency tests; the NAV gate; the reconciliation engine + 4 invariants; deterministic replay + the interleaving property test (recent commits `603ca89`, `0f3b5d1`, `158830e`).
- **In progress (this `build` branch):** the GraphQL API layer — Pothos schema, resolvers wired through the HALT gate, SSE feeds, tx tracking with optimistic positions (currently untracked under `api/src/`).
- **Not yet built:** the React UI (`web/src/App.tsx` is still a stub) and the end-to-end `verify_matrix.ts` wiring.

If asked "is it live?": the contracts and the marquee engine are real and tested; the API is being wired now; the UI is the last mile. The *product thesis is fully demonstrable today* via the contract matrix and the replay property test — which is exactly the order the build was sequenced in: **prove the hard part first.**

---

## 11. The 30-second close

> "Tokenizing a loan is easy. *Proving it's still backed — continuously, reproducibly — and refusing to pay when it isn't* is the hard part, and it's the only part that matters to an issuer, an investor, a compliance officer, or an auditor. This system makes that one provable answer. Reconciliation is a gate, not a report. Determinism is the feature. The halt is the product."
