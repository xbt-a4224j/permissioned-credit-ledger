// Mutation resolvers — drive the chain through the HALT gate · #21/#23
// The seam where the hybrid stack closes: each mutation (a) checks the reconciliation status
// FIRST and refuses to broadcast when HALTED (a ReconHaltError, distribution blocked — matrix
// rows 9-10), then (b) simulateContract (which surfaces a typed custom-error revert for free,
// no gas, no broadcast — rows 3, 5-6, 8) and (c) writeContract via the single server signer. A
// caught revert is decoded to a typed ReasonCode and thrown as a ChainRevertError. On a clean
// broadcast it records the PENDING tx + optimistic position (#23) and returns a PENDING ref.
import { GraphQLError } from "graphql";
import type { Address } from "viem";
import { isDistributionHalted } from "../recon/halt.ts";
import { decodeReason } from "../chain/errors.ts";
import { investRequest, transferRequest, claimRequest } from "../chain/credit-token.ts";
import { ChainRevertError, ReconHaltError } from "../errors.ts";
import { recordPending } from "../tx/tracker.ts";
import type { ApiContext } from "../context.ts";
import type { TxReceiptRefSource } from "../schema/types/tx.ts";
import { optimisticPositionsFor } from "../tx/reconcile.ts";

// #20 input shapes (post-scalar-validation: amount is a uint256 decimal string, wallets 0x-hex).
interface InvestArgs {
  loanId: string;
  wallet: string;
  amount: string;
}
interface TransferArgs {
  loanId: string;
  from: string;
  to: string;
  amount: string;
}
interface ClaimArgs {
  loanId: string;
  wallet: string;
}

// #21 the contract request shape simulate/write consume (address + abi + fn + args). A union
// over the three write paths so broadcastGated accepts any of mint/transfer/claim.
type ContractRequest =
  | ReturnType<typeof investRequest>
  | ReturnType<typeof transferRequest>
  | ReturnType<typeof claimRequest>;

// #21 THE gate. Read the recon status FIRST; if HALTED, throw ReconHaltError WITHOUT touching the
// chain (the point of the system — gating after broadcast would let a mismatched distribution through). Else
// simulate (typed revert surfaces here, decoded -> ChainRevertError), then write via the signer.
// Returns the broadcast tx hash for the tracker (#23). simulate/write are taken off ctx so a test
// can inject a mock chain client.
async function broadcastGated(ctx: ApiContext, request: ContractRequest): Promise<`0x${string}`> {
  // 1. HALT gate — must precede any chain interaction.
  if (await isDistributionHalted(ctx.db)) {
    const status = await ctx.recon.read();
    // the typed engine state (NavAnomaly | ReconMismatch); default to ReconMismatch if absent.
    const reason = status.haltReason === "NavAnomaly" ? "NavAnomaly" : "ReconMismatch";
    throw new ReconHaltError(reason);
  }

  // 2. simulate — surfaces the typed custom-error revert for free (no gas, no broadcast).
  try {
    await ctx.chain.publicClient.simulateContract({
      ...request,
      account: ctx.chain.account,
    });
  } catch (err) {
    const reason = decodeReason(err);
    if (reason !== null) throw new ChainRevertError(reason);
    throw err instanceof GraphQLError ? err : new GraphQLError("simulation failed", { extensions: { code: "INTERNAL" } });
  }

  // 3. write — broadcast via the single server signer; return the hash for the tracker (#23).
  return ctx.chain.walletClient.writeContract({
    ...request,
    account: ctx.chain.account,
    chain: ctx.chain.walletClient.chain,
  });
}

// #23 build the PENDING TxReceiptRef returned on a clean broadcast, attaching the optimistic
// position for an invest (the dashboard shows it before the indexer catches up).
async function pendingRef(ctx: ApiContext, hash: `0x${string}`, kind: "invest" | "transfer" | "claim", holder: string): Promise<TxReceiptRefSource> {
  let position = null as TxReceiptRefSource["position"];
  if (kind === "invest") {
    const optimistic = await optimisticPositionsFor(ctx.db, holder);
    position = optimistic.find((p) => p.id === `optimistic:${hash}`) ?? null;
  }
  return { hash, state: "PENDING", reasonCode: null, blockNumber: null, position };
}

// #21/#23 invest: mint the loan token to a wallet (PositionOpened; rows 1-3). Records PENDING +
// optimistic position, returns immediately (does NOT block on confirmation — the watcher settles).
export async function resolveInvest(ctx: ApiContext, input: InvestArgs): Promise<TxReceiptRefSource> {
  const wallet = input.wallet.toLowerCase() as Address;
  const amount = BigInt(input.amount);

  // #21 over-subscription guard: total issued for a loan must never exceed its principal. I1
  // (SupplyBacked) only checks supply == sum(position principals) — it does NOT cap against the
  // loan's own principal, so without this an investor can mint MORE claims than the loan exists,
  // overselling the asset (e.g. $5M into a $4.1M loan). Reject at the boundary before any broadcast.
  const loan = ctx.manifest.loans[input.loanId];
  if (loan === undefined) {
    throw new GraphQLError(`Unknown loan ${input.loanId}.`, { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (amount <= 0n) {
    throw new GraphQLError("Investment amount must be positive.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  const outstandingRows = await ctx.db<{ sum: string }[]>`
    select coalesce(sum(principal), 0)::text as sum from positions where loan_id = ${input.loanId} and principal > 0
  `;
  const outstanding = BigInt(outstandingRows[0]?.sum ?? "0");
  const principal = BigInt(loan.principal);
  if (outstanding + amount > principal) {
    const remaining = principal > outstanding ? principal - outstanding : 0n;
    const usd = (v: bigint): string => `$${Number(v / 1_000_000n).toLocaleString("en-US")}`;
    throw new GraphQLError(
      `Exceeds loan capacity — requested ${usd(amount)}, but only ${usd(remaining)} of ${usd(principal)} remains on loan #${input.loanId}.`,
      { extensions: { code: "EXCEEDS_PRINCIPAL" } },
    );
  }

  const request = investRequest(ctx.manifest, input.loanId, wallet, amount);
  const hash = await broadcastGated(ctx, request);
  await recordPending(ctx.db, { hash, kind: "invest", holder: wallet, loanId: input.loanId, amount });
  return pendingRef(ctx, hash, "invest", wallet);
}

// #21/#23 transfer: a gauntleted transfer (rows 5-6). Single-signer caveat: the broadcast
// originates from the server signer, so `from` is recorded for the read model but is NOT the
// on-chain sender — only RECEIVER-side gauntlet failures are reachable through this path.
// (Sender-side checks like SenderFrozen are enforced on-chain and proven by the matrix via a
// holder-simulated eth_call; holder-signed transfers are the wallet UI's job on Fuji.)
export async function resolveTransfer(ctx: ApiContext, input: TransferArgs): Promise<TxReceiptRefSource> {
  const to = input.to.toLowerCase() as Address;
  const amount = BigInt(input.amount);
  const request = transferRequest(ctx.manifest, input.loanId, to, amount);
  const hash = await broadcastGated(ctx, request);
  await recordPending(ctx.db, { hash, kind: "transfer", holder: to, loanId: input.loanId });
  return pendingRef(ctx, hash, "transfer", to);
}

// #21/#23 claim: pay a holder's accrued interest from the reserve (rows 7-8; InsufficientReserve).
export async function resolveClaim(ctx: ApiContext, input: ClaimArgs): Promise<TxReceiptRefSource> {
  const wallet = input.wallet.toLowerCase() as Address;
  const request = claimRequest(ctx.manifest, input.loanId);
  const hash = await broadcastGated(ctx, request);
  await recordPending(ctx.db, { hash, kind: "claim", holder: wallet, loanId: input.loanId });
  return pendingRef(ctx, hash, "claim", wallet);
}

// #21 export the gate for direct unit testing (mock chain client + HALTED read model).
export { broadcastGated };
