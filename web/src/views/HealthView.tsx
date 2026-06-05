// The Seam (presentation) · the reconciliation / health view — the payoff screen · #26
// The marquee made visible: a HALT banner (when state === 'HALTED'), the 4-invariant grid, the
// per-holder on-chain-vs-off-chain DeltaTable, and a stateHash + cycle footer that proves the
// engine's determinism. Read-only — renders the already-emitted SSE recon status (#22); it never
// computes a cycle, evaluates an invariant, or recomputes a delta. The 4th and final view.
import { useReconStream } from "../lib/reconStream.ts";
import { HaltBanner } from "../components/HaltBanner.tsx";
import { InvariantGrid } from "../components/InvariantGrid.tsx";
import { DeltaTable } from "../components/DeltaTable.tsx";
import { Card, LoadingState } from "../components/primitives.tsx";

export function HealthView(): JSX.Element {
  const status = useReconStream();

  if (status === undefined) {
    return (
      <Card><LoadingState label="Awaiting first reconciliation cycle…" /></Card>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Reconciliation health</h2>
        <p className="text-sm text-slate-500">Off-chain servicing cash vs on-chain claimable. The engine halts the instant they disagree.</p>
      </div>

      {status.state === "HALTED" && status.haltCode !== undefined ? <HaltBanner code={status.haltCode} /> : null}

      <Card className="p-0">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-navy-900">Invariants</div>
        <InvariantGrid invariants={status.invariants} />
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-navy-900">Balance deltas</div>
        <DeltaTable deltas={status.deltas} />
      </Card>

      <footer className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span>
          Cycle <span className="font-tabular tabular-nums text-slate-700">{status.cycle}</span>
        </span>
        <span className="font-mono break-all">stateHash {status.stateHash}</span>
      </footer>
    </section>
  );
}
