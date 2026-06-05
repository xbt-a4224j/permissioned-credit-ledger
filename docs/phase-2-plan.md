# Phase 2 — round-2 demo modules

**Theme:** extend the *shared core* (compliance · custody · accrual · reconciliation) with the three
modules the round-2 conversation rewards — **KYC onboarding**, **tranche waterfall** (done), and
**borrow-against** — then **harden for a live demo** to the Head of Engineering. Each module is
**additive** (it does not destabilize the working invest/claim/reconciliation core), and each is
framed as a *pluggable asset/feature module on the shared core* — the build-vs-buy/integration story.

> These are **not yet GitHub issues.** When greenlit, each becomes an issue tagged **`phase-2`**.
> Numbers are placeholders (continue from #41).

**Scope note — the ≤4-view cap.** v1 capped the app at ≤4 views; phase 2 deliberately relaxes that
(adds Tranches + Borrows). Either bump the cap in `CLAUDE.md` or group structuring/DeFi views — a
documented v1→v2 scope change, not an accident.

---

## P2-1 — Tranche waterfall visualizer ✅ DONE (#42)

- **Status:** built + committed on `feat/demo-modules`. Pure, tested waterfall engine
  (`web/src/lib/waterfall.ts`, 7 tests) + an animated visualizer (`TrancheVisualizer.tsx`) + the
  `Tranches` view. Off-chain only — does **not** touch the on-chain core.
- **Remaining (fold into P2-5 docs):** reconcile the "multi-tranche securitization — deliberately
  cut" line in `CLAUDE.md`/`DESIGN.md` with the visualizer's existence (the cut is the *on-chain*
  multi-class token + reconciliation-enforced waterfall; the logic is *modeled off-chain* as the
  documented next-module extension point).

---

## P2-2 — KYC onboarding module (mock provider behind an interface) · `phase-2`

- **Why.** Hits the KYC/KYB probe head-on; completes the missing *onboarding → gauntlet → invest*
  story; the cleanest **build-vs-buy** demonstration on screen (you integrate a provider, you don't
  build document verification).
- **Scope.**
  - API: a `KycProvider` interface + a `MockKycProvider` (the anti-corruption layer / vendor seam).
  - `submitKyc(wallet, name, jurisdiction, accredited, docMeta)` mutation — **metadata only**
    (`{filename, size, sha256}` hashed **client-side**; no PII transmitted or stored). On a mock
    "approve," issuer-signs `IdentityRegistry.setClaims` (verified/jurisdiction/accredited).
  - `kycStatus(wallet)` query.
  - UI: a "Verify identity" modal — file picker (client-side hash) + name + jurisdiction + accredited
    checkbox → reviewing → Verified ✓; the identity picker/badge updates live.
- **Acceptance.**
  - Pick the Unverified wallet → Invest is blocked (`NotEligible`).
  - Run KYC → the wallet flips to **Verified on-chain** → Invest now works.
  - No PII stored anywhere (assert only filename/size/sha256 persisted).
  - Tests: provider verdict mapping + the `setClaims` call; a "rejected" path.
- **Demo line.** *"KYC is a regulated commodity — you integrate Persona/Parallel Markets behind an
  interface; the part worth building is turning the verdict into an on-chain claim the gauntlet
  enforces. That's compliance-as-code."*
- **Depends on:** none (uses existing `IdentityRegistry.setClaims`). **Est:** ~half day.

---

## P2-3 — Borrow-against: engine + API · `phase-2`

- **Why.** The **keystone upside** Ian flagged (bigger than secondary). Manufactures liquidity for an
  illiquid asset and **stacks a second NIM** for the platform; introduces the new engineering surface
  (oracle / LTV / liquidation) where the role concentrates.
- **Scope.**
  - A minimal **borrow vault**: pledge a position-token as collateral → borrow USDC at a max LTV;
    **borrow interest accrues on the debt**; **liquidation** when the health factor breaches (collateral
    value falls or debt grows past the LTV limit). Decide on-chain (a small Vault contract) vs a
    modeled off-chain module like tranches — **lean on-chain-minimal** so it's "real," but keep it tiny.
  - A **collateral value oracle** (mocked NAV/price feed) + an **LTV / liquidation** rule — this is the
    "real engineering surface" talking point.
  - API: `pledgeAndBorrow(positionId, amount)`, `repay(borrowId, amount)`, `liquidate(borrowId)` (demo
    trigger), and a `borrows(holder)` query returning {collateral position, USDC borrowed, borrow
    interest accrued, current LTV, health, status}.
- **Acceptance.**
  - Pledge a position → borrow USDC → see debt + **accruing borrow interest** + LTV/health.
  - Drive collateral value down (or debt up) → **LTV breach → liquidation** seizes/sells the position.
  - The platform's **borrow NIM** (earn on the debt minus funding) is computed/shown.
  - Tests: accrual on debt, LTV math, liquidation trigger, repay.
- **Depends on:** the existing position model. **Est:** ~1 day (the biggest ticket).

## P2-4 — Borrow-against: the "Borrows" view · `phase-2`

- **Why.** The investor-facing payoff of P2-3 — and the exact view discussed: *borrows made against
  your positions, with interest accruing.*
- **Scope.**
  - A new **"Borrows"** tab (or a panel under My positions): per borrow — pledged position, USDC
    borrowed, **borrow interest ticking up** (live, like the accrual ticker), an **LTV / health bar**
    (green → amber → red), and **Repay**.
  - A "trigger liquidation" demo control (parallels the NAV/cash demo buttons).
  - Surface the **two streams** clearly: position still earns its loan yield; the borrow accrues debt
    interest; the net + the unlocked cash is the investor's win.
- **Acceptance.** Pledge → borrow → watch debt interest accrue + health move; push to liquidation →
  the position is seized and the borrow closes; numbers reconcile with P2-3.
- **Depends on:** P2-3. **Est:** ~half day.

---

## P2-5 — Integration DESIGN doc + demo script + doc coherence · `phase-2`

- **Why.** Frames the whole demo as *shared core + pluggable modules*; the build-vs-buy/keep-vs-cut
  narrative is what makes the Head of Eng see **judgment**, not just code. Also fixes the
  tranche-vs-"cut" inconsistency so the repo tells **one** story.
- **Scope.**
  - `docs/architecture/INTEGRATION.md` — the shared-core-vs-asset-module map; a **keep-vs-cut decision
    log** (what you'd reuse from Republic/INX vs what's the bought module's IP); where KYC / tranche /
    borrow-against each plug in.
  - Update `CLAUDE.md` + `DESIGN.md` "what's deliberately cut" so the on-chain-multi-tranche cut and the
    off-chain modeled waterfall are **one coherent statement**.
  - `DEMO_SCRIPT.md` — the beats mapped to *business value* (compliance-as-code → reconciliation gate →
    tranche module → borrow-against moat), with the "first 90 days" integration framing.
- **Acceptance.** A reader of the repo gets the integration thesis; no doc contradicts a feature.
- **Depends on:** P2-1..P2-4 landed (for accurate references). **Est:** ~3 hrs.

---

## P2-6 — Harden + rehearse + close the test gap · `phase-2`

- **Why.** It's a **live demo to a Head of Engineering** — a single failure costs more than any
  feature. (We hit SSE/CORS, frozen ticker, invest hang, recon auto-halt, Docker crashes this week.)
- **Scope.**
  - Kill remaining flakiness across the **happy path → HALT → recovery** and the new modules; ensure a
    **one-command bulletproof reset** and a Docker-up preflight.
  - **Close the test gap:** the root `bun run test` does **not** run the web suite (that's how stale web
    tests slipped through). Wire web tests into the root gate + CI so "tests green" means *all* tests.
  - Run the **full demo cold 5×** on a clean machine; zero console errors.
- **Acceptance.** Demo runs flawlessly 5× from clean; `bun run test` runs web tests; CI green.
- **Depends on:** all features landed. **Est:** ~half day. **Do this LAST and do not skip it.**

---

## Suggested sequence (by risk, features additive, harden last)

1. **P2-1** ✅ done
2. **P2-2** KYC (small, completes a story, low risk)
3. **P2-3 → P2-4** borrow-against (engine then view — the keystone)
4. **P2-5** docs + script (frames everything)
5. **P2-6** harden + rehearse + test gate ← never skip

**Discipline note (the Brian-pleasing move):** if time runs short, cut **P2-3/P2-4 (borrow-against)**
first and ship KYC + tranches + a bulletproof demo. A reliable, focused demo beats a feature-rich
flaky one — that's the literal Voice lesson.
