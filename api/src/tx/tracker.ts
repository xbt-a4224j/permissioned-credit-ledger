// Tx-status tracking — PENDING -> CONFIRMED|REVERTED · #23
// recordPending stamps a PENDING tx the instant invest/transfer/claim broadcasts (#21).
// startConfirmationWatcher waits for each receipt: success -> CONFIRMED (+ block); reverted ->
// REVERTED with the on-chain reason decoded to a typed ReasonCode (#21), never a raw string. It
// emits a `tx` SSE event at every transition so the UI lifecycle is push, not poll. (#66 removed
// the optimistic-position write that used to ride here; the position now comes from the indexer.)
import type { Address } from "viem";
import type { Sql } from "@pcl/shared";
import type { EventBus } from "../sse/bus.ts";
import { decodeReason } from "../chain/errors.ts";
import type { TxReceiptRefSource } from "../schema/types/tx.ts";

// #23 the minimal receipt-fetching surface the watcher needs (a viem PublicClient satisfies it,
// and a test can supply a tiny mock without rebuilding the whole client type).
export interface ReceiptClient {
  waitForTransactionReceipt(args: { hash: `0x${string}` }): Promise<{ status: "success" | "reverted"; blockNumber: bigint }>;
}

export type TxKind = "invest" | "transfer" | "claim";

export interface RecordPendingArgs {
  hash: `0x${string}`;
  kind: TxKind;
  holder: Address;
  loanId: string;
}

// #23 insert a PENDING tx_status row (idempotent on hash). The position itself is the indexer's job.
export async function recordPending(sql: Sql, args: RecordPendingArgs): Promise<void> {
  const holder = args.holder.toLowerCase();
  await sql`
    insert into tx_status (hash, kind, state, holder, loan_id)
    values (${args.hash}, ${args.kind}, 'PENDING', ${holder}, ${args.loanId})
    on conflict (hash) do nothing
  `;
}

// #23 build the TxReceiptRef SSE payload for a tx_status row (money/block as strings). reason_code
// is a free text column; cast to the typed ReasonCode the SSE/GraphQL shapes expect.
async function txEventPayload(sql: Sql, hash: string): Promise<TxReceiptRefSource> {
  const rows = await sql<{ hash: string; state: "PENDING" | "CONFIRMED" | "REVERTED"; reason_code: string | null; block_number: bigint | null }[]>`
    select hash, state, reason_code, block_number::text as block_number from tx_status where hash = ${hash}
  `;
  const r = rows[0];
  return {
    hash,
    state: r?.state ?? "PENDING",
    reasonCode: (r?.reason_code ?? null) as TxReceiptRefSource["reasonCode"],
    blockNumber: r?.block_number !== null && r?.block_number !== undefined ? r.block_number.toString() : null,
  };
}

// #23 settle ONE pending tx by its receipt. success -> CONFIRMED + block; reverted -> REVERTED +
// decoded reason. Emits exactly one `tx` SSE event for the transition. Exported for the watcher
// loop AND direct unit testing with a mocked client.
export async function settlePending(
  sql: Sql,
  client: ReceiptClient,
  bus: EventBus,
  hash: `0x${string}`,
): Promise<void> {
  let receipt: { status: "success" | "reverted"; blockNumber: bigint };
  try {
    receipt = await client.waitForTransactionReceipt({ hash });
  } catch (err) {
    // a tx that reverts on mining surfaces here on some transports; decode + mark REVERTED.
    const reason = decodeReason(err);
    await sql`
      update tx_status set state = 'REVERTED', reason_code = ${reason}, settled_at = now() where hash = ${hash} and state = 'PENDING'
    `;
    bus.publish({ type: "tx", data: await txEventPayload(sql, hash) });
    return;
  }

  if (receipt.status === "success") {
    await sql`
      update tx_status set state = 'CONFIRMED', block_number = ${receipt.blockNumber.toString()}, settled_at = now()
      where hash = ${hash} and state = 'PENDING'
    `;
  } else {
    // reverted on-chain: try to decode the revert reason from a fresh call simulation is the
    // resolver's job; here we mark REVERTED (reason may already be set by the resolver's catch).
    await sql`
      update tx_status set state = 'REVERTED', block_number = ${receipt.blockNumber.toString()}, settled_at = now()
      where hash = ${hash} and state = 'PENDING'
    `;
  }
  bus.publish({ type: "tx", data: await txEventPayload(sql, hash) });
}

// #23 the long-running watcher: drain PENDING txs and settle each (success/revert -> tx_status + SSE).
export function startConfirmationWatcher(
  sql: Sql,
  client: ReceiptClient,
  bus: EventBus,
  intervalMs = 1000,
): () => void {
  let stopped = false;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const pending = await sql<{ hash: string }[]>`select hash from tx_status where state = 'PENDING'`;
      for (const p of pending) {
        if (stopped) break;
        await settlePending(sql, client, bus, p.hash as `0x${string}`);
      }
    } catch {
      // transient DB/RPC hiccup — the next tick retries (resumable, not corrupting).
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };
  let timer = setTimeout(() => void tick(), intervalMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
