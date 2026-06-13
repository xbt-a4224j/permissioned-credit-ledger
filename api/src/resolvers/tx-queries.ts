// TxStatus query resolver — read the tracked lifecycle row · #23
// resolveTxStatus reads a broadcast tx's PENDING->CONFIRMED|REVERTED lifecycle (#23) so the UI
// (#25) can poll a single hash for its outcome — including the decoded ReasonCode on a revert.
// Returns null for an unknown hash.
import type { ApiContext } from "../context.ts";
import type { TxReceiptRefSource } from "../schema/types/tx.ts";

// #23 the tracked tx lifecycle for a hash (block/reason as strings; null if untracked).
export async function resolveTxStatus(ctx: ApiContext, hash: string): Promise<TxReceiptRefSource | null> {
  const rows = await ctx.db<
    { hash: string; state: "PENDING" | "CONFIRMED" | "REVERTED"; reason_code: string | null; block_number: bigint | null }[]
  >`
    select hash, state, reason_code, block_number::text as block_number
    from tx_status where hash = ${hash}
  `;
  const r = rows[0];
  if (r === undefined) return null;

  return {
    hash: r.hash,
    state: r.state,
    reasonCode: r.reason_code as TxReceiptRefSource["reasonCode"],
    blockNumber: r.block_number !== null ? r.block_number.toString() : null,
  };
}
