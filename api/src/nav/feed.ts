// Money Layer · scripted NAV feed driver (demo/matrix) · #17
// simulateFeed pushes a deterministic NAV series through ingestNav so the matrix verifier
// (#27) and the demo can trigger the row-9 HALT reproducibly. The 'row9Spike' scenario seeds a
// baseline mark then a +40% (4000 bps) jump that the gate must reject as OutOfBounds, flipping
// the loan to NavAnomaly + freezing accrual. 'healthy' pushes only in-bounds marks.
import { bps, unixSeconds, type LoanId, type NavReading, type Sql, type UnixSeconds } from "@pcl/shared";
import { ingestNav } from "./gate.ts";
import type { NavGateResult } from "./types.ts";

export type FeedScenario = "healthy" | "row9Spike";

function reading(loan: LoanId, navBps: number, observedAt: number): NavReading {
  return { loan, navBps: bps(navBps), observedAt: unixSeconds(observedAt), source: "servicer-sim" };
}

// #17 push a scenario; returns every gate verdict in order so callers can assert the HALT.
export async function simulateFeed(sql: Sql, loan: LoanId, scenario: FeedScenario, baseTime = 1_700_000_000): Promise<NavGateResult[]> {
  const now = unixSeconds(baseTime + 10) as UnixSeconds;
  const results: NavGateResult[] = [];

  // baseline accepted mark at par (10000 bps == 100% of par).
  results.push(await ingestNav(sql, reading(loan, 10000, baseTime), now));

  if (scenario === "healthy") {
    // a modest in-bounds drift (+5%).
    results.push(await ingestNav(sql, reading(loan, 10500, baseTime + 1), now));
  } else {
    // matrix row 9: a +40% spike (14000 bps) — 4000 bps jump > 2000 bound -> OutOfBounds HALT.
    results.push(await ingestNav(sql, reading(loan, 14000, baseTime + 1), now));
  }

  return results;
}
