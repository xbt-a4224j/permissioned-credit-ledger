// Money Layer · tx-status tracking — PENDING -> CONFIRMED|REVERTED + optimistic write · #23
// recordPending stamps a PENDING tx the instant invest/transfer/claim broadcasts (#21) and, for
// an invest, writes the optimistic position the dashboard shows before the indexer catches up.
// startConfirmationWatcher waits for each receipt: success -> CONFIRMED (+ block); reverted ->
// REVERTED with the on-chain reason decoded to a typed ReasonCode (#21), never a raw string. It
// emits a `tx` SSE event at every transition so the UI lifecycle is push, not poll.
import type { Address } from "viem";
import type { Sql } from "@pcl/shared";
import type { EventBus } from "../sse/bus.ts";
import { decodeReason } from "../chain/errors.ts";
import { reconcileOptimistic } from "./reconcile.ts";
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
  amount?: bigint;
}

// #23 insert a PENDING tx_status row (idempotent on hash); for an invest also write the optimistic
// position row so position(s) reflect it immediately (#21 merge).
export async function recordPending(sql: Sql, args: RecordPendingArgs): Promise<void> {
  const holder = args.holder.toLowerCase();
  await sql`
    insert into tx_status (hash, kind, state, holder, loan_id)
    values (${args.hash}, ${args.kind}, 'PENDING', ${holder}, ${args.loanId})
    on conflict (hash) do nothing
  `;
  if (args.kind === "invest" && args.amount !== undefined) {
    await sql`
      insert into optimistic_positions (hash, holder, loan_id, principal)
      values (${args.hash}, ${holder}, ${args.loanId}, ${args.amount.toString()})
      on conflict (hash) do nothing
    `;
  }
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
    position: null,
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

// #23 the long-running watcher: drain PENDING txs, settle each, then reconcile optimistic rows so
// a confirmed invest's optimistic placeholder is replaced by the canonical row once it lands.
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
      await reconcileOptimistic(sql);
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
