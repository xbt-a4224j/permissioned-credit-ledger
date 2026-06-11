// Idempotent event ingestion · #16
// ingestEvent inserts the chain_events row with ON CONFLICT DO NOTHING and, ONLY when the
// row was newly inserted, runs the projection — all in ONE transaction. A re-delivered log
// (reorg, WebSocket reconnect, getLogs/watch overlap) is therefore a no-op: 0 balance
// mutations. This DB-level idempotency on the canonical EventId is the precondition the
// deterministic-replay property (#19) and matrix row 10 (#18) both stand on. payload is
// serialized with bigints -> strings so numeric precision survives the jsonb round trip.
//
// The conflict target is LEFT UNSPECIFIED on purpose: chain_events carries TWO unique keys —
// the pk `id` (txHash:logIndex) and unique(block_number, log_index). A bare DO NOTHING skips on
// EITHER (the migration documents both as idempotency keys). A targeted `(id)` would let an event
// whose (block_number, log_index) already exists under a DIFFERENT id — a stale read model meeting
// a fresh chain instance — throw a unique violation and KILL the indexer process. A crashed
// indexer is the worst failure mode: the cursor freezes, the read model goes stale, and the recon
// engine eventually HALTs on a phantom mismatch with no visible cause. Failing closed to a no-op
// keeps the indexer alive; a clean reseed (wiped read model) is the only correct stale-PG recovery.
import type { Sql } from "@pcl/shared";
import { usdc6ToString, type ChainEvent } from "@pcl/shared";
import { project } from "./project.ts";

export type IngestResult = { status: "applied" | "duplicate"; id: string };

// #16 canonical jsonb payload — every bigint/Usdc6 as a decimal-free string (the #14
// serialization landmine: a default JSON.stringify of a bigint throws / loses precision).
function serializePayload(ev: ChainEvent): Record<string, string | number | boolean> {
  const common = { name: ev.name, blockNumber: ev.blockNumber.toString(), logIndex: ev.logIndex, token: ev.token };
  switch (ev.name) {
    case "PositionOpened":
    case "InterestClaimed":
      return { ...common, holder: ev.holder, loan: ev.loan, amount: usdc6ToString(ev.amount) };
    case "Transfer":
      return { ...common, loan: ev.loan, from: ev.from, to: ev.to, amount: usdc6ToString(ev.amount) };
    case "LoanStatusChanged":
      return { ...common, loan: ev.loan, status: ev.status };
    case "ClaimsUpdated":
      // #47 booleans stored natively (jsonb) so the feed's truthy checks read them correctly.
      return {
        ...common,
        account: ev.account,
        verified: ev.verified,
        accredited: ev.accredited,
        jurisdiction: ev.jurisdiction,
        frozen: ev.frozen,
      };
  }
}

// #16 insert-then-project atomically; skip projection iff the event was already seen.
export async function ingestEvent(sql: Sql, ev: ChainEvent): Promise<IngestResult> {
  return sql.begin(async (tx) => {
    const inserted = await tx`
      insert into chain_events (id, name, block_number, log_index, payload)
      values (${ev.id}, ${ev.name}, ${ev.blockNumber.toString()}, ${ev.logIndex}, ${tx.json(serializePayload(ev))})
      on conflict do nothing
      returning id
    `;
    if (inserted.length === 0) {
      // already ingested -> no projection, no mutation. The idempotency guarantee.
      return { status: "duplicate" as const, id: ev.id };
    }
    // tx is a TransactionSql; projectors take the structurally-compatible Sql tagged template.
    await project(tx as unknown as Sql, ev);
    return { status: "applied" as const, id: ev.id };
  });
}
