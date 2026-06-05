// The Seam (presentation) · the four reconciliation invariants, pass/fail · #26
// Renders exactly the 4 engine invariants (#18 I1-I4): SupplyBacked, ClaimableLeCollected,
// NavInBounds, IdentityValid. A failing row is highlighted (halt tone) and shows its detail so a
// reviewer reads WHY the engine halted. The name set is guarded against drift by HealthView's test.
import type { InvariantResult } from "../lib/reconStream.ts";
import { Badge } from "./primitives.tsx";

export function InvariantGrid(props: { invariants: InvariantResult[] }): JSX.Element {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="px-3 py-2 font-medium">Invariant</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2 font-medium">Detail</th>
        </tr>
      </thead>
      <tbody>
        {props.invariants.map((inv) => (
          <tr key={inv.name} className={`border-b border-slate-100 ${inv.ok ? "" : "bg-red-50"}`} data-testid={`invariant-${inv.name}`}>
            <td className="px-3 py-2 font-medium text-navy-900">{inv.name}</td>
            <td className="px-3 py-2">
              {inv.ok ? <Badge tone="positive">PASS</Badge> : <Badge tone="halt">FAIL</Badge>}
            </td>
            <td className="px-3 py-2 text-slate-500">{inv.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
