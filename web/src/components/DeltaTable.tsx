// On-chain vs off-chain balance deltas, per holder · #26
// Columns: holder, on-chain claimable, off-chain collected, delta. The delta is rendered as the
// engine DELIVERED it (deltaWei), never a client-recomputed subtraction in number space — a
// recompute-in-JS risks showing a different delta than the one that triggered the halt. Any row
// with a non-zero deltaWei is flagged. Reuses fmtUsd6 (#24).
import type { BalanceDelta } from "../lib/reconStream.ts";
import { fmtUsd6 } from "../lib/format.ts";
import { EmptyState } from "./primitives.tsx";

export function DeltaTable(props: { deltas: BalanceDelta[] }): JSX.Element {
  if (props.deltas.length === 0) {
    return <EmptyState label="No balance deltas — on-chain and off-chain agree." />;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="px-3 py-2 font-medium">Holder</th>
          <th className="px-3 py-2 text-right font-medium">On-chain claimable</th>
          <th className="px-3 py-2 text-right font-medium">Off-chain collected</th>
          <th className="px-3 py-2 text-right font-medium">Delta</th>
        </tr>
      </thead>
      <tbody>
        {props.deltas.map((d) => {
          const flagged = d.deltaWei !== 0n;
          return (
            <tr
              key={d.holder}
              className={`border-b border-slate-100 ${flagged ? "bg-red-50" : ""}`}
              data-flagged={flagged ? "true" : "false"}
              data-testid={`delta-${d.holder}`}
            >
              <td className="px-3 py-2 font-tabular text-navy-900">{d.holder.slice(0, 10)}…</td>
              <td className="px-3 py-2 text-right font-tabular tabular-nums">{fmtUsd6(d.onChainClaimableWei)}</td>
              <td className="px-3 py-2 text-right font-tabular tabular-nums">{fmtUsd6(d.offChainCollectedWei)}</td>
              <td className={`px-3 py-2 text-right font-tabular tabular-nums ${flagged ? "font-semibold text-halt" : "text-slate-500"}`}>
                {fmtUsd6(d.deltaWei)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
