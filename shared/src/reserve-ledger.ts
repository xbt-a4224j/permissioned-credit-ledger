// #82 reserve as an append-only ledger of record. Every credit/debit is a row in reserve_ledger;
// reserve.balance is kept as a maintained cache equal to the running sum, so the recon engine's read
// (snapshot.ts reads reserve.balance) and the matrix are unchanged — the ledger is purely additive.
// Atomic when `db` is a transaction (the indexer claim path); the operator path is a single action.
import type { Sql } from "./db/client.ts";

export type ReserveEntryKind = "credit" | "debit";

async function currentBalance(db: Sql): Promise<bigint> {
  const rows = await db<{ balance: string }[]>`select balance::text as balance from reserve where id = 1`;
  return rows[0] !== undefined ? BigInt(rows[0].balance) : 0n;
}

// #82 append a ledger entry and update the balance cache by its signed delta.
export async function appendReserveEntry(
  db: Sql,
  entry: { kind: ReserveEntryKind; amount: bigint; reason: string; loanId?: string | null },
): Promise<void> {
  const current = await currentBalance(db);
  const newBalance = entry.kind === "credit" ? current + entry.amount : current - entry.amount;
  await db`update reserve set balance = ${newBalance.toString()} where id = 1`;
  await db`
    insert into reserve_ledger (entry_type, amount, reason, loan_id, balance_after)
    values (${entry.kind}, ${entry.amount.toString()}, ${entry.reason}, ${entry.loanId ?? null}, ${newBalance.toString()})
  `;
}

// #82 set the reserve to an absolute collected figure (operator report) — posts an ADJUSTING entry so
// sum(ledger) stays equal to balance, then the balance reflects the report.
export async function reportReserveBalance(db: Sql, target: bigint, reason: string): Promise<void> {
  const current = await currentBalance(db);
  const delta = target - current;
  if (delta !== 0n) {
    const kind: ReserveEntryKind = delta > 0n ? "credit" : "debit";
    const amount = delta > 0n ? delta : -delta;
    await db`
      insert into reserve_ledger (entry_type, amount, reason, balance_after)
      values (${kind}, ${amount.toString()}, ${reason}, ${target.toString()})
    `;
  }
  await db`update reserve set balance = ${target.toString()} where id = 1`;
}

// #82 reset the ledger to a single genesis funding entry (called by the seed). Keeps the ledger
// consistent across re-seeds/resets instead of accumulating duplicate funding rows.
export async function seedReserveLedger(db: Sql, funded: bigint): Promise<void> {
  await db`delete from reserve_ledger`;
  await db`update reserve set balance = ${funded.toString()} where id = 1`;
  await db`
    insert into reserve_ledger (entry_type, amount, reason, balance_after)
    values ('credit', ${funded.toString()}, 'initial funding', ${funded.toString()})
  `;
}
