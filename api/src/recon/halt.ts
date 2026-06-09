// Distribution halt gate · #18
// The HALT must block payouts, not merely report. isDistributionHalted reports whether the most
// recent reconciliation cycle failed; assertCanDistribute throws a typed DistributionHalted the
// claim mutation (ticket 21) calls before paying, so a ReconMismatch / NavAnomaly actually
// stops distribution. No best-effort, no partial pay — the boundary is the product.
import type { EngineState, Sql } from "@pcl/shared";
import { DistributionHalted, type InvariantId } from "./types.ts";

// #18 true while the latest recon_status row is a failure (ok = false).
export async function isDistributionHalted(sql: Sql): Promise<boolean> {
  const rows = await sql<{ ok: boolean }[]>`select ok from recon_status order by cycle_id desc limit 1`;
  return rows[0] !== undefined && rows[0].ok === false;
}

// #18 throw DistributionHalted (carrying the typed state + failed invariant) if a halt is
// active; no-op after a clean cycle. The claim path (21) calls this before moving reserve value.
export async function assertCanDistribute(sql: Sql): Promise<void> {
  const rows = await sql<{ ok: boolean; state: EngineState | null; failed_invariant: string | null }[]>`
    select ok, state, failed_invariant from recon_status order by cycle_id desc limit 1
  `;
  const last = rows[0];
  if (last !== undefined && last.ok === false) {
    throw new DistributionHalted(last.state ?? "Unknown", (last.failed_invariant ?? undefined) as InvariantId | undefined);
  }
}
