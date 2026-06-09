// Operator/servicing write paths — NAV marks + collected-cash reports · #38
// The two servicer-side mutations. submitNav routes a mark through the NAV gate (ingestNav), which
// accepts or rejects it against bounds — an out-of-bounds mark (e.g. 14000 bps = +40%) trips the
// NavAnomaly HALT, the same mechanism matrix row 9 proves. reportCash sets the off-chain collected
// balance the I2 ClaimableCovered invariant checks against — reporting below aggregate claimable
// trips ReconMismatch, the row-10 mechanism. Both run a recon cycle inline so the verdict returns
// immediately instead of waiting for the driver's next tick. Both are LOCAL-NODE ONLY: the mock
// reserve and the local feed are fixtures, and these must never run against Fuji (same posture as
// scripts/demo_reset.ts NonLocalRpcRefused).
import { GraphQLError } from "graphql";
import { loanId as toLoanId, unixSeconds, bps } from "@pcl/shared";
import { ingestNav } from "../nav/gate.ts";
import type { SnapshotManifest } from "../recon/snapshot.ts";
import { runReconCycle } from "../recon/engine.ts";
import { runOneCycle } from "../recon/driver.ts";
import type { ApiContext } from "../context.ts";
import type { ReconStatusView } from "../recon-reader.ts";

const LOCAL_CHAIN_ID = 31337;

// #38 refuse any non-local chain — these mutations touch the mock reserve / local feed and must
// never run against Fuji.
function assertLocal(ctx: ApiContext): void {
  if (ctx.chain.publicClient.chain?.id !== LOCAL_CHAIN_ID) {
    throw new GraphQLError("Operator ops are local-node only and were refused on a non-local chain.", {
      extensions: { code: "NonLocalRpcRefused" },
    });
  }
}

// #38 the loan id arrives as a GraphQL Int (loan series are 1..6); brand it after a positive-int guard.
function checkedLoanId(loanIdInt: number): ReturnType<typeof toLoanId> {
  if (!Number.isInteger(loanIdInt) || loanIdInt <= 0) {
    throw new GraphQLError("loanId must be a positive integer.", { extensions: { code: "BadUserInput" } });
  }
  return toLoanId(loanIdInt);
}

// #38 submit a NAV reading via the gate (ingestNav), run one cycle, return recon status. The gate
// performs the bounds validation — this accepts any mark and lets the gate decide.
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

// #38 set the reserve balance to amountUsdc6, run one recon cycle, return status. Validates
// amountUsdc6 is a non-negative bigint string before touching the DB. The reserve is one global
// row (a deliberate scope cut), so this is a platform-wide figure, not per-loan.
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
