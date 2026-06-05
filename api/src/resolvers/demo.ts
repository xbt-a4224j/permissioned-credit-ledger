// The Seam · demo-only marquee triggers — make rows 9-10 reachable from the running app · #33 (bug)
// Bug #33: the only mutations were invest/claim/transfer, so the NavAnomaly / ReconMismatch HALTs
// (the marquee) could never be triggered live — only verify_matrix.ts exercised them in-process.
// These two resolvers expose them through GraphQL, reusing the EXACT matrix mechanisms so the live
// demo and the test suite halt for the same reasons. Both are LOCAL-NODE ONLY (they mutate chain
// time / the mock reserve) — they hard-refuse any non-local chain, mirroring demo_reset's guard so
// a fumbled trigger can never touch Fuji.
import { GraphQLError } from "graphql";
import { toHex } from "viem";
import { loanId as toLoanId, unixSeconds, bps } from "@pcl/shared";
import { simulateFeed } from "../nav/feed.ts";
import { ingestNav } from "../nav/gate.ts";
import { loadSnapshot, type SnapshotManifest } from "../recon/snapshot.ts";
import { runReconCycle } from "../recon/engine.ts";
import { runOneCycle } from "../recon/driver.ts";
import type { ApiContext } from "../context.ts";
import type { ReconStatusView } from "../recon-reader.ts";

const LOCAL_CHAIN_ID = 31337;

// #33 refuse any non-local chain — these triggers manipulate chain time + the mock reserve and must
// never broadcast against Fuji (same posture as scripts/demo_reset.ts NonLocalRpcRefused).
function assertLocal(ctx: ApiContext): void {
  if (ctx.chain.publicClient.chain?.id !== LOCAL_CHAIN_ID) {
    throw new GraphQLError("Demo triggers are local-node only and were refused on a non-local chain.", {
      extensions: { code: "NonLocalRpcRefused" },
    });
  }
}

// #33 the loan id arrives as a GraphQL Int (loan series are 1..6); brand it after a positive-int guard.
function checkedLoanId(loanIdInt: number): ReturnType<typeof toLoanId> {
  if (!Number.isInteger(loanIdInt) || loanIdInt <= 0) {
    throw new GraphQLError("loanId must be a positive integer.", { extensions: { code: "BadUserInput" } });
  }
  return toLoanId(loanIdInt);
}

// #33 anvil clock control via the raw RPC (evm_increaseTime + evm_mine). Cast through the viem
// request surface — these are anvil-only methods, gated by assertLocal above.
async function advanceLocalChain(ctx: ApiContext, seconds: number): Promise<void> {
  const request = ctx.chain.publicClient.request as unknown as (args: { method: string; params: unknown[] }) => Promise<unknown>;
  await request({ method: "evm_increaseTime", params: [toHex(seconds)] });
  await request({ method: "evm_mine", params: [] });
}

// #33 row 9: push the matrix +40% NAV spike through the feed. ingestNav rejects it as OutOfBounds
// and writes a NavAnomaly recon_status HALT (freezing accrual for the loan); we run one cycle so the
// status reflects immediately rather than waiting for the driver's next tick.
export async function resolvePushNav(ctx: ApiContext, loanIdInt: number): Promise<ReconStatusView> {
  assertLocal(ctx);
  const ln = checkedLoanId(loanIdInt);
  await simulateFeed(ctx.db, ln, "row9Spike");
  await runOneCycle(ctx);
  return ctx.recon.read();
}

// #33 row 10: drive the off-chain reserve (collected cash) BELOW aggregate on-chain claimable so the
// I2 ClaimableCovered invariant breaks -> ReconMismatch HALT, and a subsequent claim is refused.
// Precondition: at least one open position has accrued claimable (the seeded world + rows 1-2 give
// this); we advance the local clock so interest has actually accrued, then under-fund by one unit.
export async function resolveInjectCash(ctx: ApiContext, loanIdInt: number): Promise<ReconStatusView> {
  assertLocal(ctx);
  checkedLoanId(loanIdInt);
  await advanceLocalChain(ctx, 30 * 24 * 3600);
  const snapshot = await loadSnapshot(ctx.db, ctx.chain.publicClient, ctx.manifest as unknown as SnapshotManifest);
  const shortfall = snapshot.onchainClaimableTotal > 0n ? snapshot.onchainClaimableTotal - 1n : 0n;
  await ctx.db`update reserve set balance = ${shortfall.toString()} where id = 1`;
  await runReconCycle(ctx.db, ctx.chain.publicClient, ctx.manifest as unknown as SnapshotManifest);
  return ctx.recon.read();
}

// #38 the platform ops path: submit any navBps reading via the NAV gate (ingestNav), run one cycle,
// return recon status. The gate performs bounds validation — this is NOT a demo spike; it accepts
// any mark and lets the gate decide. Local-node only (same posture as the demo triggers).
export async function resolveSubmitNav(ctx: ApiContext, loanIdInt: number, navBps: number): Promise<ReconStatusView> {
  assertLocal(ctx);
  const ln = checkedLoanId(loanIdInt);
  const reading = {
    loan: ln,
    navBps: bps(navBps),
    observedAt: unixSeconds(Math.floor(Date.now() / 1000)),
    source: "ops",
  };
  await ingestNav(ctx.db, reading, reading.observedAt);
  await runOneCycle(ctx);
  return ctx.recon.read();
}

// #38 the platform ops path: set the reserve balance to amountUsdc6, run one recon cycle, return
// status. Validates amountUsdc6 is a non-negative bigint string before touching the DB.
// Local-node only — the mock reserve is an on-chain fixture, not the real USDC escrow.
export async function resolveReportCash(ctx: ApiContext, loanIdInt: number, amountUsdc6: string): Promise<ReconStatusView> {
  assertLocal(ctx);
  checkedLoanId(loanIdInt);
  if (!/^\d+$/.test(amountUsdc6)) {
    throw new GraphQLError("amount must be a non-negative integer string (Usdc6 base units).", {
      extensions: { code: "BadUserInput" },
    });
  }
  await ctx.db`update reserve set balance = ${amountUsdc6} where id = 1`;
  await runReconCycle(ctx.db, ctx.chain.publicClient, ctx.manifest as unknown as SnapshotManifest);
  return ctx.recon.read();
}
