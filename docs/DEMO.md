<!-- The click-by-click live walkthrough · #30 -->

# Demo — the live walkthrough

A timed, click-by-click script where **every feature is reachable from the running app**: invest (eligible + rejected-with-reason-badge), the live accrual ticker, claim, a `NavAnomaly` HALT, and a `ReconMismatch` HALT. Run it straight through in ~6 minutes.

The seam at a glance: [`architecture/04-offchain-onchain-reconciliation.svg`](architecture/04-offchain-onchain-reconciliation.svg).

## Pre-run checklist

1. Bring the whole stack up (Postgres + local node + deploy/seed + indexer + API + web):
   ```bash
   bun run dev
   ```
   Wait for the banner. Live URLs: web http://localhost:51730 · GraphQL http://localhost:41990/graphql · SSE http://localhost:41990/sse.
2. If you want a guaranteed-clean cold start, reset the local world first (< 30s):
   ```bash
   bun run scripts/demo_reset.ts
   ```
3. Confirm the matrix is green **before** going live:
   ```bash
   bun run scripts/verify_matrix.ts     # must print: 10/10 scenarios passed.
   ```
4. Open the web app at http://localhost:51730. Four views: **Marketplace** and **My positions** (investor tabs — the "Acting as" wallet picker shows here), plus the platform tabs **Servicing** and **Health** (header reads "Acting as Issuer / servicer"). The **Servicing** view has the global reserve panel at top — Collected / Claimable / Covered badge plus the "Report collected cash" form (USDC base units) — then per-loan cards with each loan's NAV mark (bps of par — 10000 = 100%) and NAV history.

**Abort rule:** if any step above fails — `bun run dev` doesn't reach the banner, or `verify_matrix.ts` prints anything other than `10/10 scenarios passed.` — **stop and reset** (`bun run scripts/demo_reset.ts`) before demoing. Never demo against a stack that isn't `10/10`.

## Script

Each row: the action, the expected typed code/event, and the UI / SSE signal. The ten rows map 1:1 to `scripts/verify_matrix.ts` (#27) and the scenario matrix in `CLAUDE.md`.

| # | Action (in the app) | Expected typed outcome | UI / SSE signal |
|---|---|---|---|
| 1 | Invest as **accredited-US** into a CRE loan | OK — `PositionOpened` | Position appears on the dashboard; accrual ticker starts |
| 2 | Invest as **Reg-S non-US** into a loan | OK — `PositionOpened` | Second position opens; both accrue |
| 3 | Invest as **unverified** wallet | revert `ReceiverNotVerified` | Red reason-code badge **`ReceiverNotVerified`** on the invest panel |
| 4 | Transfer **as the frozen holder** (the harness simulates the call as the frozen sender via a `transferAs` `eth_call`) | revert `SenderFrozen` | Reason-code badge **`SenderFrozen`** |
| 5 | US holder on a **Reg-S** offering | revert `NotEligible` | Reason-code badge **`NotEligible`** |
| 6 | Transfer a **Reg-D** token to a verified **US non-accredited** wallet | revert `AccreditationRequired` | Reason-code badge **`AccreditationRequired`** |
| 7 | Let accrual run, then **claim** with the reserve funded (fund via **Servicing → "Report collected cash"**) | OK — `InterestClaimed`, reserve debited, accrued reset | Accrual ticker resets to 0; reserve balance drops; `InterestClaimed` in the live feed |
| 8 | **Claim** when owed exceeds the reserve | revert `InsufficientReserve` | Reason-code badge **`InsufficientReserve`**; no payout |
| 9 | Health view → **"Submit +40% NAV mark"** (calls `submitNav` at 14000 bps; the bound is ±20%) | HALT **`NavAnomaly`**, accrual frozen | Reconciliation panel flips to a **HALT banner — `NavAnomaly`**; accrual ticker freezes |
| 10 | Health view → **"Report cash below claimable"** (reads `reserve.totalClaimable`, calls `reportCash(claimable − 1)`); the next recon cycle catches it | HALT distribution **`ReconMismatch`** | **HALT banner — `ReconMismatch`**; a subsequent claim is refused (`DistributionHalted`) |

> Row 10 needs non-zero claimable: if `reserve.totalClaimable` is 0, the button tells you to invest first — run rows 1–2 and let accrual build before triggering it.

**Recovering a HALT (no reset required):**
- A **`NavAnomaly`** (row 9) clears when you submit a **corrective in-bounds NAV mark** on the loan — e.g. a par `10000` bps mark on the Servicing card. The freeze tracks the *latest* NAV verdict, so a good mark un-freezes it and the next recon cycle re-opens distribution. (The "halt → fix the feed → resume" beat.)
- A **`ReconMismatch`** (row 10) clears when you **fund the reserve** back above aggregate claimable (Servicing → "Report collected cash").

To start completely fresh between runs:

```bash
bun run scripts/demo_reset.ts
```

**Narration beats:** rows 1–2 are the happy path (the gauntlet *passes*); rows 3–6 are the gauntlet *rejecting* with typed reason-code badges (no stringly-typed errors); rows 7–8 are the cash path (claim against the reserve); rows 9–10 show the engine failing closed — halting distribution rather than paying out value that isn't there.

## Fuji deploy

For a live-on-a-real-chain moment, deploy the contracts to the **Avalanche Fuji** C-Chain testnet and point the indexer at Fuji. This requires `FUJI_RPC` + a faucet-funded `PRIVATE_KEY` in `.env`.

```bash
# 1. deploy + broadcast to Fuji (uses .env FUJI_RPC + PRIVATE_KEY)
forge script script/Deploy.s.sol --rpc-url "$FUJI_RPC" --broadcast

# 2. refresh the single-source-of-truth ABIs for the off-chain layer (#13)
bash scripts/copy_abis.sh

# 3. point the indexer at Fuji (chain id 43113) instead of the local node
#    set LOCAL_RPC/CHAIN to the Fuji values, then restart the indexer
```

Open the deployed `CreditToken` on the Snowtrace explorer to show it is a real on-chain contract:

```
https://testnet.snowtrace.io/address/<deployed CreditToken address>
```

> **Never** point `demo_reset.ts` at Fuji — it hard-refuses any non-local RPC (`NonLocalRpcRefused`) precisely so a fumbled live reset can't broadcast real testnet txs and burn the faucet. Correctness is only ever asserted against the local node (public Fuji RPCs rate-limit and lag); Fuji is the live-demo target only.

## Backup combinations

Plan-B per fragile scenario, so a flaky moment never stalls the demo.

| Fragile step | What can go wrong | Plan B |
|---|---|---|
| Fuji deploy | RPC rate-limit / timeout / dropped faucet balance | Skip Fuji; demo entirely on the local node (the matrix is local-only anyway) |
| Row 9 NAV HALT | Stale feed state from a prior run | `bun run scripts/demo_reset.ts`, re-run, hit **"Submit +40% NAV mark"** again |
| Row 10 ReconMismatch | A prior HALT is still latched, or claimable is 0 | Reset, replay rows 1–2 + 7 to build claimable, then hit **"Report cash below claimable"** again |
| Live accrual ticker | SSE connection dropped | Reload the web app (the feed reconnects) or read `reconciliationStatus` via GraphQL |
| Whole stack wedged | Orphaned port / stale container | `bun run stop` then `bun run dev` (idempotent, port-safe) |

## If something breaks live

Recovery, in order of escalation:

```bash
bun run scripts/demo_reset.ts        # chief recovery: wipe + redeploy + reseed the local world (< 30s)
bun run scripts/verify_matrix.ts     # confirm 10/10 scenarios passed. before resuming
bun run stop && bun run dev          # full teardown + clean bring-up if the reset can't recover
```

If `verify_matrix.ts` still doesn't print `10/10 scenarios passed.` after a reset, do not resume the live demo — fall back to the recorded matrix output and the architecture diagrams in [`architecture/`](architecture/).
