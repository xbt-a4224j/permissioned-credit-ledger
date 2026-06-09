// Replay = sort by canonical order, fold with a deterministic clock · #19
// replay(inputs) is the verification oracle: it sorts the append-only inputs into their ONE
// canonical order and folds them into a single ReplayState. The clock `now` is derived from the
// inputs (max NAV observedAt) — never Date.now() — so the fold is a pure function of the input
// SET, identical for every arrival interleaving. loadInputs reconstructs the inputs from the
// Postgres read model (chain_events + nav_readings) so a cold replay matches the live engine.
import { bps, eventId, identityAddr, loanId, unixSeconds, usdc6, type ChainEvent, type NavReading, type Sql, type UnixSeconds } from "@pcl/shared";
import { applyInput, orderKey } from "./fold.ts";
import { emptyState } from "./state.ts";
import type { ReplayInput, ReplayState } from "./types.ts";

// #19 the deterministic replay clock: the latest NAV observedAt in the set (0 if no NAV). Held
// constant across all interleavings of the same set, so staleness is reproducible.
export function replayClock(inputs: ReplayInput[]): UnixSeconds {
  let max = 0;
  for (const i of inputs) if (i.kind === "nav") max = Math.max(max, i.reading.observedAt);
  return unixSeconds(max);
}

// #19 sort into canonical order, then fold from empty. Interleaving-invariant by construction.
// After the fold, a post-pass evaluates the replay-expressible reconciliation break so replay
// reproduces BOTH HALT outcomes: a NAV reject already set NavAnomaly during the fold (it takes
// precedence); a reserve driven negative by over-claiming (paid more than collected) is the
// replay analog of I2 ClaimableCovered and surfaces as ReconMismatch.
export function replay(inputs: ReplayInput[]): ReplayState {
  const now = replayClock(inputs);
  const ordered = [...inputs].sort((a, b) => (orderKey(a) < orderKey(b) ? -1 : orderKey(a) > orderKey(b) ? 1 : 0));
  const folded = ordered.reduce((s, input) => applyInput(s, input, now), emptyState());
  if (folded.halted === null && folded.reserve.balance < 0n) {
    folded.halted = { state: "ReconMismatch", failed: "ClaimableCovered" };
  }
  return folded;
}

// #19 reconstruct a ChainEvent from a chain_events row's typed jsonb payload.
function eventFromRow(row: { id: string; name: string; block_number: bigint; log_index: number; payload: Record<string, unknown> }): ChainEvent {
  const p = row.payload;
  const [txHash, logIdxStr] = row.id.split(":");
  const base = {
    id: eventId(txHash!, Number(logIdxStr)),
    blockNumber: row.block_number,
    logIndex: row.log_index,
    token: identityAddr(p["token"] as string),
  } as const;
  switch (row.name) {
    case "PositionOpened":
      return { ...base, name: "PositionOpened", holder: identityAddr(p["holder"] as string), loan: loanId(p["loan"] as string), amount: usdc6(p["amount"] as string) };
    case "InterestClaimed":
      return { ...base, name: "InterestClaimed", holder: identityAddr(p["holder"] as string), loan: loanId(p["loan"] as string), amount: usdc6(p["amount"] as string) };
    case "Transfer":
      return { ...base, name: "Transfer", loan: loanId(p["loan"] as string), from: identityAddr(p["from"] as string), to: identityAddr(p["to"] as string), amount: usdc6(p["amount"] as string) };
    case "LoanStatusChanged":
      return { ...base, name: "LoanStatusChanged", loan: loanId(p["loan"] as string), status: p["status"] as "PERFORMING" | "DELINQUENT" | "DEFAULT" };
    default:
      throw new Error(`unknown chain_event name in replay: ${row.name}`);
  }
}

// #19 load the canonical inputs from Postgres: every chain_event + every nav_reading (accepted
// AND rejected, so replay re-derives the same HALTs). The fold re-sorts, so SELECT order is
// irrelevant.
export async function loadInputs(sql: Sql): Promise<ReplayInput[]> {
  const events = await sql<{ id: string; name: string; block_number: bigint; log_index: number; payload: Record<string, unknown> }[]>`
    select id, name, block_number, log_index, payload from chain_events
  `;
  const navs = await sql<{ loan_id: string; nav_bps: number; observed_at: bigint; source: string }[]>`
    select loan_id, nav_bps, observed_at, source from nav_readings
  `;

  const inputs: ReplayInput[] = [];
  for (const e of events) inputs.push({ kind: "chain", event: eventFromRow(e) });
  for (const n of navs) {
    const reading: NavReading = { loan: loanId(n.loan_id), navBps: bps(n.nav_bps), observedAt: unixSeconds(Number(n.observed_at)), source: n.source };
    inputs.push({ kind: "nav", reading });
  }
  return inputs;
}
