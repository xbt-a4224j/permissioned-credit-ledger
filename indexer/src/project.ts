// On-Chain Layer · pure-ish projectors: ChainEvent -> read-model rows · #16
// Each projector applies one decoded event to the Postgres read model INSIDE the same
// transaction that inserts the chain_events row (ingest.ts), so projection and event-record
// commit atomically — a crash can never leave the read model ahead of or behind the event
// log (which would make every downstream invariant, #18, lie). Money goes in as decimal-free
// strings via usdc6ToString so numeric(78,0) never sees a lossy number (the #14 landmine).
//
// Balance model: `positions.principal` (the token balance) is maintained SOLELY by Transfer
// (mint = from 0x0 credit; burn = to 0x0 debit; transfer = debit+credit). PositionOpened only
// ensures the position row exists and stamps opened_at — so a mint's paired Transfer +
// PositionOpened never double-count principal, in any arrival order.
import type { Sql } from "@pcl/shared";
import { identityAddr, positionId, usdc6ToString, type ChainEvent, type IdentityAddr, type LoanId, type Usdc6 } from "@pcl/shared";

// #16 the ERC20 mint source / burn sink sentinel (zero address), branded for comparison.
const ZERO: IdentityAddr = identityAddr("0x0000000000000000000000000000000000000000");

// #16 ensure a (loan, holder) position row exists (principal/accrued default 0). Idempotent.
async function ensurePosition(tx: Sql, loan: LoanId, holder: IdentityAddr, openedAt: number | null): Promise<void> {
  const id = positionId(loan, holder);
  await tx`
    insert into positions (id, loan_id, holder, principal, accrued, opened_at)
    values (${id}, ${loan}, ${holder}, 0, 0, ${openedAt})
    on conflict (id) do update set opened_at = coalesce(positions.opened_at, excluded.opened_at)
  `;
}

// #16 add (signed) to a holder's principal. Skips the 0x0 sentinel (mint source / burn sink).
async function addPrincipal(tx: Sql, loan: LoanId, holder: IdentityAddr, delta: Usdc6, credit: boolean): Promise<void> {
  if (holder === ZERO) return;
  await ensurePosition(tx, loan, holder, null);
  const amt = usdc6ToString(delta);
  const id = positionId(loan, holder);
  if (credit) {
    await tx`update positions set principal = principal + ${amt} where id = ${id}`;
  } else {
    await tx`update positions set principal = principal - ${amt} where id = ${id}`;
  }
}

// #16 matrix rows 1,2 — stamp the position opened by a mint (loan + opened_at). Principal is
// applied by the paired Transfer, not here.
export async function applyPositionOpened(tx: Sql, ev: Extract<ChainEvent, { name: "PositionOpened" }>): Promise<void> {
  await ensurePosition(tx, ev.loan, ev.holder, Number(ev.blockNumber));
}

// #16 the balance source of truth: credit `to`, debit `from`. 0x0 endpoints are mint/burn.
export async function applyTransfer(tx: Sql, ev: Extract<ChainEvent, { name: "Transfer" }>): Promise<void> {
  await addPrincipal(tx, ev.loan, ev.from, ev.amount, false);
  await addPrincipal(tx, ev.loan, ev.to, ev.amount, true);
}

// #16 matrix row 7 — a funded claim debits the reserve and resets the holder's accrued.
export async function applyInterestClaimed(tx: Sql, ev: Extract<ChainEvent, { name: "InterestClaimed" }>): Promise<void> {
  const amt = usdc6ToString(ev.amount);
  // single-row reserve (id=1); upsert so the first claim before any reserve seed still works.
  await tx`
    insert into reserve (id, balance, updated_at) values (1, 0, ${Number(ev.blockNumber)})
    on conflict (id) do nothing
  `;
  await tx`update reserve set balance = balance - ${amt}, updated_at = ${Number(ev.blockNumber)} where id = 1`;
  await tx`update positions set accrued = 0 where id = ${positionId(ev.loan, ev.holder)}`;
}

// #16 loan status transition -> update loans.status (drives the off-chain accrual-gate
// replay, #19). The loan row may not be seeded in tests; update is a no-op if absent.
export async function applyLoanStatusChanged(tx: Sql, ev: Extract<ChainEvent, { name: "LoanStatusChanged" }>): Promise<void> {
  await tx`update loans set status = ${ev.status} where id = ${ev.loan}`;
}

// #16 dispatch a decoded event to its projector (used inside ingest's transaction).
export async function project(tx: Sql, ev: ChainEvent): Promise<void> {
  switch (ev.name) {
    case "PositionOpened":
      return applyPositionOpened(tx, ev);
    case "Transfer":
      return applyTransfer(tx, ev);
    case "InterestClaimed":
      return applyInterestClaimed(tx, ev);
    case "LoanStatusChanged":
      return applyLoanStatusChanged(tx, ev);
  }
}
