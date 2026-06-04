// Money Layer · off-chain accrual freeze gate · #17
// The NAV gate's HALT must actually stop the off-chain engine from advancing accrued for a
// loan (matrix row 9 "accrual frozen"). isAccrualFrozen reports whether a loan currently sits
// under a NavAnomaly halt; accrualMultiplier turns that into the 0/1 the engine + UI use to
// freeze the ticker. This gate does NOT touch on-chain accrual math (that is the contract's
// freezeAccrual, #9) — it gates whether the off-chain engine/replay advances accrued.
import type { LoanId, Sql } from "@pcl/shared";

// #17 a loan is frozen iff its most recent NAV-related recon_status is a NavAnomaly halt that
// no later clean cycle (ok=true) has cleared. Sticky, mirroring the on-chain freeze.
export async function isAccrualFrozen(sql: Sql, loan: LoanId): Promise<boolean> {
  const rows = await sql<{ frozen: boolean }[]>`
    with last_halt as (
      select cycle_id from recon_status
      where state = 'NavAnomaly' and detail ->> 'loan' = ${loan}
      order by cycle_id desc limit 1
    ),
    last_clear as (
      select cycle_id from recon_status where ok = true order by cycle_id desc limit 1
    )
    select
      exists(select 1 from last_halt) and
      (not exists(select 1 from last_clear)
        or (select cycle_id from last_halt) > (select cycle_id from last_clear)) as frozen
  `;
  return rows[0]?.frozen ?? false;
}

// #17 0 while frozen, 1 while accruing — the engine/UI multiply the per-cycle accrual delta by
// this so a NavAnomaly freezes the off-chain ticker exactly when the loan is halted.
export async function accrualMultiplier(sql: Sql, loan: LoanId): Promise<0n | 1n> {
  return (await isAccrualFrozen(sql, loan)) ? 0n : 1n;
}
