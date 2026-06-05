// Money Layer · optimistic-position reconciliation — converge to the indexer's truth · #23
// The optimistic invest row is a projection that MUST converge to on-chain reality (a micro-
// instance of the project thesis). reconcileOptimistic deletes an optimistic row once the indexer
// (#16) has projected the canonical positions row at/after the tx's settling block — matched
// strictly by (holder, loan) AND block_number (never a bare heuristic), so two rapid invests on
// one loan reconcile independently. Idempotent: a second run deletes 0. optimisticPositionsFor
// synthesizes the GraphQL Position rows the query layer (#21) merges before catch-up.
import type { Sql } from "@pcl/shared";
import type { PositionSource } from "../schema/types/position.ts";

// #23 delete every optimistic row whose CONFIRMED tx has a canonical positions row projected at
// or after its settling block. Returns the count deleted (0 on a no-op second run).
export async function reconcileOptimistic(sql: Sql): Promise<{ removed: number }> {
  // a canonical row "exists at/after block" when positions.opened_at (the stamping block, #16)
  // is >= the tx block_number for the same (holder, loan). opened_at is a block number here.
  const removed = await sql<{ hash: string }[]>`
    delete from optimistic_positions o
    using tx_status t, positions p
    where o.hash = t.hash
      and t.state = 'CONFIRMED'
      and t.block_number is not null
      and p.holder = o.holder
      and p.loan_id = o.loan_id
      and p.opened_at is not null
      and p.opened_at >= t.block_number
    returning o.hash
  `;
  return { removed: removed.length };
}

// #23 a holder's outstanding optimistic positions as GraphQL Position sources (optimistic=true).
// Only rows still present (not yet reconciled) are returned; merged by the query layer (#21).
export async function optimisticPositionsFor(sql: Sql, holder: string): Promise<PositionSource[]> {
  const rows = await sql<{ hash: string; loan_id: string; principal: bigint; created_at: Date }[]>`
    select hash, loan_id, principal::text as principal, created_at
    from optimistic_positions where holder = ${holder.toLowerCase()}
    order by loan_id::int
  `;
  return rows.map((r) => ({
    id: `optimistic:${r.hash}`,
    holder: holder.toLowerCase(),
    loanId: r.loan_id,
    principal: r.principal.toString(),
    accrued: "0",
    claimable: "0",
    lastAccrualAt: r.created_at,
    optimistic: true,
  }));
}
