// Structuring module · the Tranches view — the waterfall made visible · #38
// Frames the visualizer with the architecture story: this is the asset-specific cash-flow MODULE
// that plugs into the same shared core (compliance, custody, reconciliation) the single-loan flow
// uses. The platform's existing distribution is the one-tranche degenerate case; this generalizes it
// to a priority waterfall — the shared primitive across CRE tranches AND a fund's carry waterfall.
import { TrancheVisualizer } from "../components/TrancheVisualizer.tsx";
import { Card } from "../components/primitives.tsx";

export function TranchesView(): JSX.Element {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Structured pool — the tranche waterfall</h2>
        <p className="text-sm text-slate-500">
          Priority of payments: income pays coupons senior-first; losses are absorbed junior-first. Drag the sliders.
        </p>
      </div>

      <Card>
        <TrancheVisualizer />
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="text-sm font-semibold text-navy-900">Why the senior is safe & cheap</div>
          <p className="mt-1 text-sm text-slate-600">
            The junior/equity tranche is the <b>first-loss buffer</b> — it's wiped before the senior loses a dollar.
            That credit enhancement is what lets the senior price tight. Watch the bad-year preset.
          </p>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-navy-900">One engine, two legs</div>
          <p className="mt-1 text-sm text-slate-600">
            The same priority-of-payments runs a CRE pool's tranches <i>and</i> a fund's carry waterfall
            (return of capital → hurdle → GP catch-up → 80/20). Different knobs, one parameterized module.
          </p>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-navy-900">How it plugs in</div>
          <p className="mt-1 text-sm text-slate-600">
            On-chain multi-tranche securitization is <b>deliberately cut from the v1 core</b> (the token stays
            single-class). The waterfall is <b>modeled off-chain as a pure, tested module</b> — this view shows the
            logic and exactly where it becomes the next asset-module on the same shared core.
          </p>
        </Card>
      </div>
    </section>
  );
}
