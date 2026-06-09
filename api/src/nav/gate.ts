// NAV/servicing feed ingestion gate · #17
// ingestNav is the stateful wrapper around the pure bounds predicate: it loads the last
// ACCEPTED mark for the loan (never the last received — the cascade landmine), runs
// withinBounds, and persists the outcome. Accepted -> nav_readings(accepted=true). Rejected ->
// nav_readings(accepted=false, reject_reason) + a recon_status HALT row (state='NavAnomaly')
// that freezes accrual for the loan (matrix row 9). All money/time flow through @pcl/shared
// constructors; all SQL is parameterized via the tagged-template driver.
import { keccak256, toHex } from "viem";
import { bps, loanId, unixSeconds, type LoanId, type NavReading, type Sql, type UnixSeconds } from "@pcl/shared";
import { withinBounds } from "./bounds.ts";
import type { NavGateResult } from "./types.ts";

// #17 load the last ACCEPTED reading for a loan (the bounds baseline).
async function lastAccepted(sql: Sql, loan: LoanId): Promise<NavReading | null> {
  const rows = await sql<{ nav_bps: number; observed_at: bigint; source: string }[]>`
    select nav_bps, observed_at, source from nav_readings
    where loan_id = ${loan} and accepted = true
    order by observed_at desc
    limit 1
  `;
  const r = rows[0];
  if (r === undefined) return null;
  return { loan, navBps: bps(r.nav_bps), observedAt: unixSeconds(Number(r.observed_at)), source: r.source };
}

// #17 does the loan exist in the read model? (UnknownLoan guard).
async function loanKnown(sql: Sql, loan: LoanId): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`select exists(select 1 from loans where id = ${loan}) as exists`;
  return rows[0]?.exists ?? false;
}

// #17 deterministic state_hash marker for a NAV-halt recon_status row (recon_status.state_hash
// is NOT NULL; the full replay hash is #19's job — this is a stable, traceable placeholder).
function navHaltHash(reading: NavReading, reason: string): `0x${string}` {
  return keccak256(toHex(`navhalt:${reading.loan}:${reading.observedAt}:${reason}`));
}

export async function ingestNav(sql: Sql, reading: NavReading, now: UnixSeconds): Promise<NavGateResult> {
  const known = await loanKnown(sql, reading.loan);
  const prev = known ? await lastAccepted(sql, reading.loan) : null;
  const verdict = withinBounds(prev, reading, now, known);

  if (verdict.ok) {
    await sql`
      insert into nav_readings (loan_id, nav_bps, observed_at, source, accepted, reject_reason)
      values (${reading.loan}, ${reading.navBps}, ${reading.observedAt}, ${reading.source}, true, null)
    `;
    return { accepted: true, reading };
  }

  // rejected: record the reading AND a recon_status NavAnomaly halt that freezes accrual.
  // Skip the nav_readings row for an UnknownLoan — the loan FK would reject it (and there is
  // no loan to store a mark against); the recon_status halt (no FK) still captures it.
  if (known) {
    await sql`
      insert into nav_readings (loan_id, nav_bps, observed_at, source, accepted, reject_reason)
      values (${reading.loan}, ${reading.navBps}, ${reading.observedAt}, ${reading.source}, false, ${verdict.reason})
    `;
  }
  await sql`
    insert into recon_status (ok, state, failed_invariant, state_hash, detail)
    values (false, 'NavAnomaly', 'NavInBounds', ${navHaltHash(reading, verdict.reason)},
      ${sql.json({ loan: reading.loan, reason: verdict.reason, navBps: reading.navBps, observedAt: reading.observedAt })})
  `;
  return { accepted: false, state: "NavAnomaly", reason: verdict.reason };
}

// #17 re-export the LoanId constructor for feed drivers that build readings from raw ids.
export { loanId };
