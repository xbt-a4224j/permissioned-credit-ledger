// Live reconciliation driver — runs cycles in the running app · #32 (bug)
// Bug #32: runReconCycle() was only ever called by the test harness, so the live API never wrote a
// recon_status row — the Health tab was stuck on "awaiting first cycle" and the HALT gate had
// nothing to read. This driver closes that gap: it runs a reconciliation cycle on a fixed interval
// (and once immediately on boot), so the reconciliation verdict is always live. Each cycle's insert fires the existing
// `recon_changed` NOTIFY trigger (#22 migration), so the SSE recon source pushes it to the UI with
// no extra wiring. A NavAnomaly (rejected NAV mark) or ReconMismatch (under-reported cash) is therefore picked
// up within one interval and stays sticky until a later all-green cycle (or demo_reset) clears it.
import type { ApiContext } from "../context.ts";
import { runReconCycle } from "./engine.ts";
import type { SnapshotManifest } from "./snapshot.ts";

// #32 the context manifest (indexer Manifest) is structurally a SnapshotManifest (loans[key] carries
// loanId + token); narrow it here so the engine call is type-clean.
function snapshotManifest(ctx: ApiContext): SnapshotManifest {
  return ctx.manifest as unknown as SnapshotManifest;
}

// #32 run one cycle now (used on boot and by the ops mutations for immediate feedback). Swallows
// transient chain/DB read errors — the next tick retries — so a flaky RPC never crashes the API.
export async function runOneCycle(ctx: ApiContext): Promise<void> {
  try {
    await runReconCycle(ctx.db, ctx.chain.publicClient, snapshotManifest(ctx));
  } catch {
    /* transient read error — the next interval retries. */
  }
}

// #32 start the driver: an immediate cycle, then one every intervalMs. Returns a stop fn that the
// boot calls on teardown. Default 2s keeps the Health panel live without hammering the node.
export function startReconDriver(ctx: ApiContext, intervalMs = 2000): () => void {
  let stopped = false;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    await runOneCycle(ctx);
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };
  let timer = setTimeout(() => void tick(), 0);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
