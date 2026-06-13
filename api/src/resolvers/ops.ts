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
import CreditTokenArtifact from "../abi/CreditToken.json";

const LOCAL_CHAIN_ID = 31337;

// #66 runtime-deploy constants. RATE_SCALE mirrors CreditToken.RATE_SCALE; RESERVE_FUNDING mirrors
// Deploy.s.sol so funded claims on the new loan succeed.
const RATE_SCALE = 10n ** 18n;
const SECONDS_PER_YEAR = 31_536_000n;
const RESERVE_FUNDING = 1_000_000_000_000n; // 1,000,000e6
const RESERVE_MINT_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
] as const;

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

// #66/#67/#68 the result of tokenizing a warehouse loan.
export interface TokenizeResult {
  loanId: string;
  tokenAddress: string;
  txHash: string;
}

// #66 tokenize a warehouse loan: deploy a real CreditToken on-chain (same wiring as the seeded 6),
// fund its reserve (#67) so funded claims succeed, register it in the loans read model so the
// indexer (#75) watches it and it appears in the marketplace, and flag the warehouse row (#68).
// LOCAL-NODE ONLY (deploys + mints the mock reserve).
export async function resolveTokenizeLoan(ctx: ApiContext, warehouseLoanId: string): Promise<TokenizeResult> {
  assertLocal(ctx);
  if (typeof warehouseLoanId !== "string" || warehouseLoanId.length === 0 || warehouseLoanId.length > 32) {
    throw new GraphQLError("warehouseLoanId must be a non-empty id.", { extensions: { code: "BadUserInput" } });
  }

  const rows = await ctx.db<
    { principal: string; ltv_bps: number; dscr_bps: number; coupon_bps: number; property_type: string; tokenized: boolean }[]
  >`
    select principal::text as principal, ltv_bps, dscr_bps, coupon_bps, property_type, tokenized
    from wh_book where loan_id = ${warehouseLoanId}
  `;
  const wl = rows[0];
  if (wl === undefined) {
    throw new GraphQLError(`Unknown warehouse loan ${warehouseLoanId}.`, { extensions: { code: "BadUserInput" } });
  }
  if (wl.tokenized) {
    throw new GraphQLError(`Loan ${warehouseLoanId} is already tokenized.`, { extensions: { code: "AlreadyTokenized" } });
  }

  // wh_book.principal is dollars; on-chain principalCap + loans.principal are 6-decimal base units.
  const principalBase = BigInt(Math.round(Number(wl.principal))) * 1_000_000n;
  const ratePerSecond = (BigInt(wl.coupon_bps) * RATE_SCALE) / (10_000n * SECONDS_PER_YEAR);
  const collateral = wl.property_type === "Residential" ? "RESIDENTIAL" : "CRE";
  const maxRows = await ctx.db<{ max: number }[]>`select coalesce(max(id::int), 0) as max from loans`;
  const newId = String((maxRows[0]?.max ?? 0) + 1);

  // #66 deploy a real CreditToken — identical constructor wiring to the seeded 6 (RegD offering).
  const deployHash = await ctx.chain.walletClient.deployContract({
    abi: CreditTokenArtifact.abi,
    bytecode: CreditTokenArtifact.bytecode.object as `0x${string}`,
    account: ctx.chain.account,
    chain: ctx.chain.walletClient.chain,
    args: [
      ctx.chain.account.address,
      ctx.manifest.identityRegistry as `0x${string}`,
      ctx.manifest.complianceRegistryRegD as `0x${string}`,
      ctx.manifest.reserve as `0x${string}`,
      ratePerSecond,
      principalBase,
    ],
  });
  const receipt = await ctx.chain.publicClient.waitForTransactionReceipt({ hash: deployHash });
  const tokenAddress = receipt.contractAddress;
  if (tokenAddress == null) {
    throw new GraphQLError("CreditToken deploy produced no contract address.", { extensions: { code: "INTERNAL" } });
  }

  // #67 fund the new token's reserve so funded claims succeed (mirrors Deploy.s.sol reserve.mint).
  await ctx.chain.walletClient.writeContract({
    address: ctx.manifest.reserve as `0x${string}`,
    abi: RESERVE_MINT_ABI,
    functionName: "mint",
    args: [tokenAddress, RESERVE_FUNDING],
    account: ctx.chain.account,
    chain: ctx.chain.walletClient.chain,
  });

  // #66/#68 register the loan in the read model. The indexer (#75) watches the token within one
  // refresh; a par NAV baseline keeps the new loan at 100% so it doesn't false-halt.
  const appraised = (principalBase * 10_000n) / BigInt(wl.ltv_bps);
  await ctx.db`insert into properties (id, address_label, appraised_value, lien_position)
    values (${newId}, ${"Tokenized series #" + newId}, ${appraised.toString()}, 1) on conflict (id) do nothing`;
  await ctx.db`insert into loans (id, principal, rate_bps, status, started_at, collateral_type, property_id, ltv_bps, dscr_bps, token_address)
    values (${newId}, ${principalBase.toString()}, ${wl.coupon_bps}, 'PERFORMING', 0, ${collateral}, ${newId}, ${wl.ltv_bps}, ${wl.dscr_bps}, ${tokenAddress.toLowerCase()})`;
  await ctx.db`insert into nav_readings (loan_id, nav_bps, observed_at, source, accepted)
    values (${newId}, 10000, ${unixSeconds(Math.floor(Date.now() / 1000))}, 'tokenize', true)`;

  // #68 flag the warehouse row tokenized + link the on-chain address.
  await ctx.db`update wh_book set tokenized = true, token_address = ${tokenAddress.toLowerCase()} where loan_id = ${warehouseLoanId}`;

  return { loanId: newId, tokenAddress, txHash: deployHash };
}
