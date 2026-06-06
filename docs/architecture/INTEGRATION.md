# Integration architecture — shared core + pluggable asset modules

> The thesis in one line: **one compliant-securities core, built once; asset-specific modules plug
> on top.** That makes this a take-rate *infrastructure* business, not a single-asset lender — and it
> makes "add a new asset class" a module, not a rebuild. This is the lens for the build-vs-buy and
> integration work.

## The seam

Everything splits into two layers. Get the seam right and adding non-QM residential, a venture
fund, or a third originator is *cheap*; get it wrong and you have N platforms.

| Layer | What it is | Built how |
|---|---|---|
| **Shared core** (build once) | KYC / identity · compliance gauntlet (Reg D/S) · custody / signer · cap-table / indexer · USDC distribution + SSE · the reconciliation gate | Reused by **every** asset. The expensive, regulated part. |
| **Asset module** (per asset) | origination · servicing · the cash-flow **waterfall** | Swapped per asset class. The only genuinely-new code per leg. |

The single-loan credit flow is the **one-tranche degenerate case** of the waterfall; the venture leg
is the same engine with fund-carry knobs. Same core, different module.

## What plugs in today (and what's deferred)

| Module | Status | Note |
|---|---|---|
| CRE single-loan | **live** | iBorrow bridge — the anchor/proof |
| Residential | **live** | same rails; `collateralType` flips; consumer-law (TILA/RESPA) is a named extension point, not built |
| Tranche waterfall | **modeled** | pure, tested off-chain engine + visualizer; on-chain multi-class is deliberately cut |
| Borrow-against | **phase-2** | the keystone — depends on NAV/reconciliation integrity being proven first |
| Venture / fund | **phase-2** | the Republic leg; fund-shaped, same waterfall engine |

## Build-vs-buy decision log

The senior judgment the role is about — *what earns its place in the platform vs what you integrate.*

| Capability | Decision | Why |
|---|---|---|
| KYC / document verification | **Buy** (Persona / Parallel Markets) | Regulated commodity. Here: a `KycProvider` interface + a mock impl — the integration is a one-file swap. The part worth building is *the verdict → on-chain claim*. |
| Custody / key management | **Buy** (Fireblocks-class MPC + policy) | Solved, regulated. Don't roll your own keys. |
| Permissioned token standard | **Adopt** (ERC-3643 / T-REX pattern) | Audited institutional standard; don't reinvent transfer compliance. |
| Secondary venue | **Buy / reuse** (Republic's INX ATS) | A licensed BD + ATS + transfer-agent is years of work — reuse it. |
| **The reconciliation gate** | **Build** | The differentiator: proving the on-chain claim stays backed, and halting when it can't. |
| **The waterfall / cash-flow engine** | **Build** | The shared primitive across tranches, fund carry, and venture — parameterize once. |
| **The borrow-against vault** (phase-2) | **Build** | The keystone money-market; the oracle/LTV/liquidation surface is where the new engineering concentrates. |

**Principle:** buy the commodity, build the differentiator. The differentiator here is the
*compliant-distribution + integrity + borrow-against* stack, not the token mechanics.

## What's deliberately cut (and why it's a decision, not an omission)

- **On-chain multi-tranche securitization** — the token stays single-class; the waterfall is *modeled*
  off-chain (pure + tested) and visualized as the documented next module. Building multi-class tokens
  before the distribution core is proven is scope you don't need to demonstrate the thesis.
- **Real custody + real USDC** — mock reserve; the integration seam (Fireblocks) is named, not built.
- **Real multi-tenancy / white-label** — the platform *supports* a second originator conceptually
  (the shared core is asset-agnostic); building tenant isolation is a phase-3 concern.
- **A fee / billing engine** — the take-rate stack is *modeled and labeled*, not metered.
- **Auth / login** — out of scope; the seeded-identity picker stands in (the server is the signer).

Cutting these is what keeps the demo's core bulletproof — and it's the discipline the role rewards.

## First-90-days integration framing

If the mortgage product is *bought* and plugged into Republic's existing platform:

1. **Map the seams (days 0–30).** Inventory the bought product against the layer table; tag every
   layer *keep / cut / re-platform*. Reuse Republic's INX (cap-table + ATS), KYC/compliance, custody,
   and USDC rails. Keep iBorrow's origination + servicing + waterfall IP. Deliverable: a keep-vs-cut
   decision doc.
2. **ACL + first slice (days 30–60).** An anti-corruption layer translating the bought product's
   holder/position model into the shared core; migrate one deal; stand up the reconciliation harness
   comparing both ledgers.
3. **Prove parity, then peel (days 60–90).** Run in parallel until reconciliation shows zero
   divergence; cut over; retire the duplicated KYC/token/indexer, keep only the asset module.

No big-bang rewrite. Strangler-fig behind an anti-corruption layer, reconciliation-gated at every step.
