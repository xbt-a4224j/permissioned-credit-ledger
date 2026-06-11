// Off-chain accrual freeze gate · #17
// The NAV gate's HALT must actually stop the off-chain engine from advancing accrued for a
// loan (matrix row 9 "accrual frozen"). isAccrualFrozen reports whether a loan currently sits
// under a NavAnomaly halt; accrualMultiplier turns that into the 0/1 the engine + UI use to
// freeze the ticker. This gate does NOT touch on-chain accrual math (that is the contract's
// freezeAccrual, #9) — it gates whether the off-chain engine/replay advances accrued.
import type { LoanId, Sql } from "@pcl/shared";

// #49 a loan is frozen iff its MOST RECENT NAV reading is a rejection. This reflects the live feed,
// not recon_status stickiness: an out-of-bounds spike (accepted=false) freezes accrual, and a later
// in-bounds corrective mark (accepted=true) becomes the latest reading and UN-freezes it — the next
// recon cycle then writes ok=true and distribution resumes, no world reset required.
//
// The previous definition (a NavAnomaly recon_status halt with no later ok=true cycle) DEADLOCKED:
// while frozen, I3 re-failed every cycle, so ok=true was never written and only a reset could clear
// it — a corrective mark couldn't. Reading the feed's latest verdict makes "halt → fix the feed →
// resume" work, which is both the demo beat and the more honest model (the gate tracks current state).
export async function isAccrualFrozen(sql: Sql, loan: LoanId): Promise<boolean> {
  const rows = await sql<{ accepted: boolean }[]>`
    select accepted from nav_readings
    where loan_id = ${loan}
    order by observed_at desc, id desc
    limit 1
  `;
  return rows[0] !== undefined && rows[0].accepted === false;
}

// #17 0 while frozen, 1 while accruing — the engine/UI multiply the per-cycle accrual delta by
// this so a NavAnomaly freezes the off-chain ticker exactly when the loan is halted.
export async function accrualMultiplier(sql: Sql, loan: LoanId): Promise<0n | 1n> {
  return (await isAccrualFrozen(sql, loan)) ? 0n : 1n;
}
