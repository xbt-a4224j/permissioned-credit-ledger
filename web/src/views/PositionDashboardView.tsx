// On-Chain Layer mirror (presentation) · the position dashboard — live per-second accrual · #24
// Runs POSITIONS_QUERY for the active holder and renders a PositionRow per position, wired to the
// SSE accrual stream (#22) so claimable counts up live off the engine's pushed value (never a
// client setInterval). `frozenHolders`/`globalFrozen` are the row-9 NavAnomaly freeze inputs #26
// supplies from the recon stream; #24 defaults them off. `renderActions` is the mount point #25
// fills with Claim/Transfer. Clean loading/error/empty states.
import type { ReactNode } from "react";
import type { IdentityAddr, LoanId, Position, PositionId } from "../types.ts";
import { POSITIONS_QUERY } from "../queries.ts";
import { useQuery } from "../lib/useQuery.ts";
import { useAccrualStream } from "../lib/sse.ts";
import { PositionRow } from "../components/PositionRow.tsx";
import { Banner, Card, EmptyState, ErrorState, LoadingState } from "../components/primitives.tsx";

// #24 the demo holder the dashboard reads when no wallet is connected (#25 swaps in the live
// wallet address). A seeded accredited-US identity so row-1 positions render on first load.
export const DEMO_HOLDER = (import.meta.env.VITE_DEMO_HOLDER ?? "0x70997970c51812dc3a010c7d01b50e0d17dc79c8") as IdentityAddr;

interface PositionsRaw {
  positions: { id: string; loanId: string; holder: string; principal: string; accrued: string; claimable: string; optimistic: boolean }[];
}

function mapPositions(raw: PositionsRaw): Position[] {
  return raw.positions.map((p) => ({
    id: p.id as PositionId,
    loanId: p.loanId as LoanId,
    holder: p.holder.toLowerCase() as IdentityAddr,
    principal: BigInt(p.principal),
    accrued: BigInt(p.accrued),
    claimable: BigInt(p.claimable),
    optimistic: p.optimistic,
  }));
}

export function PositionDashboardView(props: {
  holder?: `0x${string}` | undefined;
  globalFrozen?: boolean;
  renderActions?: (position: Position) => ReactNode;
} = {}): JSX.Element {
  const holder = (props.holder ?? DEMO_HOLDER) as IdentityAddr;
  const ticks = useAccrualStream();
  const { loading, error, data, reload } = useQuery<PositionsRaw, Position[], { holder: string }>(
    POSITIONS_QUERY,
    mapPositions,
    { holder },
  );

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-navy-900">My positions</h2>
        <p className="text-sm text-slate-500">Claimable interest accrues per second, streamed from the reconciliation engine.</p>
      </div>
      {/* #26 row-9 inline halt hint: the accrual ticker is frozen by a NAV anomaly. */}
      {props.globalFrozen === true ? (
        <div className="mb-4">
          <Banner tone="halt" title="Accrual frozen — NAV anomaly">
            A NAV anomaly tripped the validation gate; per-second accrual is paused until reconciliation clears. See Health.
          </Banner>
        </div>
      ) : null}
      <Card className="p-0">
        {loading ? (
          <LoadingState label="Loading positions…" />
        ) : error !== null ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data === null || data.length === 0 ? (
          <EmptyState label="No open positions for this holder." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Loan</th>
                <th className="px-3 py-2 text-right font-medium">Principal</th>
                <th className="px-3 py-2 text-right font-medium">Claimable</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((position) => (
                <PositionRow
                  key={position.id}
                  position={position}
                  tick={ticks.get(position.id)}
                  frozen={props.globalFrozen ?? false}
                  actionSlot={props.renderActions?.(position)}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
