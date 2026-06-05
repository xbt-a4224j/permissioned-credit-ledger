// On-Chain Layer mirror (presentation) · a holder position row with a live accrual ticker · #24
// Renders principal, the live claimable (count-up from the SSE tick, #22), and the loan status.
// The ticker derives its value from the engine-pushed `claimableWei` — never a client setInterval —
// so the displayed number tracks the deterministic on-chain accrued (#9). When `frozen` is set (the
// row-9 NavAnomaly freeze that #26 wires from the recon stream), the ticker visibly stops and the
// last accrued value holds. The `actionSlot` is the mount point #25 fills with Claim/Transfer.
import type { ReactNode } from "react";
import type { Position } from "../types.ts";
import type { AccrualTick } from "../lib/sse.ts";
import { fmtUsd6 } from "../lib/format.ts";
import { Badge } from "./primitives.tsx";

export function PositionRow(props: { position: Position; tick?: AccrualTick | undefined; frozen?: boolean; actionSlot?: ReactNode }): JSX.Element {
  const { position, tick, frozen } = props;
  // live claimable: the tick when present and not frozen, else the canonical on-chain value.
  const claimable = frozen || tick === undefined ? position.claimable : tick.claimableWei;

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-3 text-left">
        <div className="font-tabular font-semibold text-navy-900">#{position.loanId}</div>
        <div className="text-xs text-slate-400">{position.holder.slice(0, 10)}…</div>
      </td>
      <td className="px-3 py-3 text-right font-tabular tabular-nums">{fmtUsd6(position.principal)}</td>
      <td className="px-3 py-3 text-right font-tabular tabular-nums" aria-live="polite">
        <span className={`text-lg font-semibold ${frozen ? "text-slate-400" : "text-positive"}`}>{fmtUsd6(claimable)}</span>
      </td>
      <td className="px-3 py-3 text-left">
        {frozen ? (
          <Badge tone="halt" title="Accrual frozen by a NAV anomaly">Frozen</Badge>
        ) : (
          <Badge tone="positive">Accruing</Badge>
        )}
        {position.optimistic ? (
          <span className="ml-2"><Badge tone="warn" title="Pending confirmation">Pending</Badge></span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-right">{props.actionSlot}</td>
    </tr>
  );
}
