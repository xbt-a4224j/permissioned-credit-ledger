// The Seam (presentation) · the reconciliation / health view — the payoff screen · #26
// The marquee made visible: a HALT banner (when state === 'HALTED'), the 4-invariant grid, the
// per-holder on-chain-vs-off-chain DeltaTable, and a stateHash + cycle footer that proves the
// engine's determinism. Read-only — renders the already-emitted SSE recon status (#22); it never
// computes a cycle, evaluates an invariant, or recomputes a delta. The 4th and final view.
import type { ReconStatus } from "../lib/reconStream.ts";
import { HaltBanner } from "../components/HaltBanner.tsx";
import { InvariantGrid } from "../components/InvariantGrid.tsx";
import { DeltaTable } from "../components/DeltaTable.tsx";
import { DemoControls } from "../components/DemoControls.tsx";
import { ChainActivity } from "../components/ChainActivity.tsx";
import { ActionLog } from "../components/ActionLog.tsx";
import { Card, LoadingState } from "../components/primitives.tsx";

// #40 status comes from App's single shared recon stream (one EventSource for the whole shell) so
// the panel can never diverge from the header pill and there's no second connection to starve.
export function HealthView(props: { status: ReconStatus | undefined }): JSX.Element {
  const status = props.status;

  if (status === undefined) {
    // #36 the driver (#32) emits a cycle within ~2s of boot — this is a brief connecting state,
    // not a permanent empty one, so it reads as "connecting" rather than a broken epoch-zero panel.
    return (
      <Card><LoadingState label="Connecting to the reconciliation engine…" /></Card>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Reconciliation health</h2>
        <p className="text-sm text-slate-500">Off-chain servicing cash vs on-chain claimable. The engine halts the instant they disagree.</p>
      </div>

      {status.state === "HALTED" && status.haltCode !== undefined ? <HaltBanner code={status.haltCode} /> : null}

      <DemoControls />

      <Card className="p-0">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-navy-900">Invariants</div>
        <InvariantGrid invariants={status.invariants} />
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-navy-900">Balance deltas</div>
        <DeltaTable deltas={status.deltas} />
      </Card>

      <ChainActivity />
      <ActionLog />

      <footer className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span>
          Cycle <span className="font-tabular tabular-nums text-slate-700">{status.cycle}</span>
        </span>
        <span className="font-mono break-all">stateHash {status.stateHash}</span>
      </footer>
    </section>
  );
}
