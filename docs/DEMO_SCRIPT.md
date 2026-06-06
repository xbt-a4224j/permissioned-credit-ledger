# Demo script — the platform walkthrough

The reframed narration: lead with the **platform thesis**, treat reconciliation as the *gate* (not the
product), and name the boundaries as deliberate decisions. ~6 minutes. (The click-by-click matrix
version is `docs/DEMO.md`; this is the *story*.)

**Before you start:** `bun run scripts/demo_reset.ts` → wait for `OK`. Hard-reload the app.

> **The one sentence to open and close with:**
> *"One compliant securities core; here are the asset modules plugged onto it — single-loan ✓,
> residential ✓, tranche waterfall next; reconciliation is the gate that makes those assets
> trustworthy enough to **lend against**, which is the phase-2 keystone."*

---

## Beat 0 — The platform (30s) · **Loans** tab

Open here, not on the marketplace. Point at the **Platform architecture** panel.

> *"This isn't a single product — it's infrastructure. A shared core — KYC, compliance, custody,
> distribution, reconciliation — built once, with asset modules plugged on top. CRE and residential
> are live on the same rails; the tranche waterfall and borrow-against are the next modules. And it's
> a take-rate business — the spread is the big line, borrow-against is the keystone upside, secondary
> trading is deliberately small."*

That frames everything that follows as *one module of a platform*, which is the build-vs-buy story.

## Beat 1 — The compliance front door (90s) · **Marketplace**

1. Identity picker → **Unverified** → click **Invest** → **`NotEligible`** (red badge).
2. Header → **Verify** → upload any file, name, jurisdiction, accredited → **Submit** → **Verified ✓**.
3. Invest again → **succeeds**.

> *"KYC is a regulated commodity — you integrate Persona or Parallel Markets behind an interface, you
> don't build document verification. The part worth building is what just happened: the verdict became
> an on-chain claim, and the transfer gauntlet enforces it by construction. That's compliance-as-code —
> a non-compliant holder is impossible, not just disallowed."*

## Beat 2 — Live, provable yield (45s) · **My positions**

Watch the claimable tick up.

> *"Every tick is pushed from the engine, not a timer in the browser guessing an APY. What you see is
> the authoritative on-chain value — that's the difference between this and a fintech that calculates
> yield client-side and hopes it matches the books."*

## Beat 3 — The gate that makes it bankable (90s) · **Health**

Show the 4 green invariants + the stateHash + the live block/event feed.

> *"This is the gate, not the product. Every cycle it proves servicing cash and on-chain claimable
> agree — four invariants, a deterministic replay, a byte-exact stateHash."*

Click **Push +40% NAV** → header flips red **HALTED**, accrual freezes.

> *"A bad mark came in and the system stopped itself — it refuses to distribute value it can't prove is
> backed. And here's why it matters for the roadmap: you can't lend USDC against collateral you can't
> price and trust. This gate is the prerequisite for the keystone — borrow-against."*

*(Optional: "the same gate also catches a cash-vs-claimable shortfall — that's the ReconMismatch HALT.")*

## Beat 4 — The next module (45s) · **Tranches**

Drag the sliders; hit **Bad year**.

> *"Same shared core, a structuring module on top. Income pays coupons top-down; losses hit the junior
> first — the first-loss tranche is what makes the senior safe to sell. It's the same priority-of-
> payments engine that runs a fund's carry waterfall. I scoped on-chain multi-tranche out of v1 on
> purpose and modeled it off-chain — this shows the logic and where it plugs in."*

## The close (30s)

> *"So: one compliant core, asset modules plugged on top, reconciliation as the gate that makes them
> bankable. The keystone — borrow-against, the second margin on the same loan — is phase-2 on purpose:
> building it before the distribution core was proven would have been the trap. That's the platform,
> and that's the integration the role is about."*

---

## If something breaks live

```bash
bun run scripts/demo_reset.ts     # wipe + redeploy + reseed (< 15s), then hard-reload
```

Never demo against a stack that isn't clean. If the engine is HALTED from a prior run, reset first.
