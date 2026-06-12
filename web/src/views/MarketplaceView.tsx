// The loan marketplace — the seeded mortgage tape, CRE-first · #24
// Runs LOANS_QUERY and renders a grid of LoanCards (>=6: 5 CRE + 1 RESIDENTIAL per the seed). Each
// card shows the mortgage modeling (LTV/DSCR/collateral) + the data room. Clean loading/error/empty
// states. The Invest action is mounted by #25 via LoanCard's actionSlot — this view stays read-only.
import type { ReactNode } from "react";
import type { Loan, LoanId, LoanStatus } from "../types.ts";
import { LOANS_QUERY } from "../queries.ts";
import { useQuery } from "../lib/useQuery.ts";
import { LoanCard } from "../components/LoanCard.tsx";
import { Card, EmptyState, ErrorState, LoadingState } from "../components/primitives.tsx";

// #24 the raw LOANS_QUERY response (BigIntStr money as decimal strings).
interface LoansRaw {
  loans: { id: string; principal: string; subscribed: string; ratePerSecond: string; ltvBps: number; dscrBps: number; status: LoanStatus; dataRoomUri: string | null }[];
}

// #24 decode the wire shape to the bigint-carrying Loan view model (never a JS number for money).
function mapLoans(raw: LoansRaw): Loan[] {
  return raw.loans.map((l) => ({
    id: l.id as LoanId,
    principal: BigInt(l.principal),
    subscribed: BigInt(l.subscribed),
    ratePerSecond: BigInt(l.ratePerSecond),
    ltvBps: l.ltvBps,
    dscrBps: l.dscrBps,
    status: l.status,
    collateralType: "CRE", // overridden per-card by collateralTypeFor (the seam); not in the SDL
    dataRoomUri: l.dataRoomUri,
  }));
}

// #24 allow a render prop so #25 can inject the Invest button per loan without editing this view.
export function MarketplaceView(props: { renderAction?: (loan: Loan) => ReactNode } = {}): JSX.Element {
  const { loading, error, data, reload } = useQuery<LoansRaw, Loan[]>(LOANS_QUERY, mapLoans);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-navy-900">Loan marketplace</h2>
        <p className="text-sm text-slate-500">First-lien mortgages on income-producing property. CRE-first; residential plugs into identical rails.</p>
      </div>
      {loading ? (
        <Card><LoadingState label="Loading loan tape…" /></Card>
      ) : error !== null ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : data === null || data.length === 0 ? (
        <Card><EmptyState label="No loans in the tape yet." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((loan) => (
            <LoanCard key={loan.id} loan={loan} actionSlot={props.renderAction?.(loan)} />
          ))}
        </div>
      )}
    </section>
  );
}
