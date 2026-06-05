// the platform platform ops · Loans view — operator's servicing feed → validation gate → distribution · #38
// Queries all loans + the reserve state, then renders a LoanOpsCard per loan. Read-only data path
// is the same pattern as MarketplaceView (useQuery + loading/error/empty states); the write path
// lives inside each card so this view has no mutation state of its own.
import type { Loan, LoanId, LoanStatus } from "../types.ts";
import { LOANS_QUERY } from "../queries.ts";
import { useQuery } from "../lib/useQuery.ts";
import { gql } from "../lib/graphqlClient.ts";
import { useEffect, useState } from "react";
import { LoanOpsCard } from "../components/LoanOpsCard.tsx";
import { Card, EmptyState, ErrorState, LoadingState } from "../components/primitives.tsx";

// #38 the reserve coverage shape (mirrors api/schema.graphql ReserveState).
// Exported so LoanOpsCard can import the type without duplicating it.
export interface ReserveState {
  balance: bigint;
  totalClaimable: bigint;
}

// #38 raw wire shape for the reserve query.
interface ReserveRaw {
  reserve: { balance: string; totalClaimable: string };
}

// #38 raw LOANS_QUERY response (BigIntStr money as decimal strings, same as MarketplaceView).
interface LoansRaw {
  loans: {
    id: string;
    principal: string;
    ratePerSecond: string;
    ltvBps: number;
    dscrBps: number;
    status: LoanStatus;
    dataRoomUri: string | null;
  }[];
}

// #38 decode wire loans to bigint view models (mirrors MarketplaceView.mapLoans).
function mapLoans(raw: LoansRaw): Loan[] {
  return raw.loans.map((l) => ({
    id: l.id as LoanId,
    principal: BigInt(l.principal),
    ratePerSecond: BigInt(l.ratePerSecond),
    ltvBps: l.ltvBps,
    dscrBps: l.dscrBps,
    status: l.status,
    collateralType: "CRE", // seam: overridden per-card by collateralTypeFor; not in the SDL
    dataRoomUri: l.dataRoomUri,
  }));
}

// #38 the reserve query — a standalone gql() call (not useQuery) because the reserve is
// a single global value, not per-loan, and a simple refetch-on-mount is enough here.
const RESERVE_QUERY = /* GraphQL */ `
  query Reserve {
    reserve { balance totalClaimable }
  }
`;

export function LoansView(): JSX.Element {
  const { loading: loansLoading, error: loansError, data: loans, reload } = useQuery<LoansRaw, Loan[]>(
    LOANS_QUERY,
    mapLoans,
  );

  // #38 reserve state: fetched once on mount; errors are soft (the cards still render without it).
  const [reserve, setReserve] = useState<ReserveState | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);

  useEffect(() => {
    gql<ReserveRaw>(RESERVE_QUERY)
      .then((raw) => {
        setReserve({
          balance: BigInt(raw.reserve.balance),
          totalClaimable: BigInt(raw.reserve.totalClaimable),
        });
      })
      .catch((err: unknown) => {
        setReserveError(err instanceof Error ? err.message : "Could not load reserve");
      });
  }, []);

  // #38 a zero-value fallback so cards render even if the reserve query is still in-flight.
  const effectiveReserve: ReserveState = reserve ?? { balance: 0n, totalClaimable: 0n };

  return (
    <section aria-labelledby="loans-ops-heading">
      {/* ---- Header ---- */}
      <div className="mb-6">
        <h2 id="loans-ops-heading" className="text-xl font-semibold text-navy-900">Loan operations</h2>
        <p className="text-sm text-slate-500">
          the originator&rsquo;s servicing feed &rarr; the platform&rsquo;s validation gate &rarr; on-chain distribution
        </p>
      </div>

      {/* ---- Reserve error (soft — does not block the loan cards) ---- */}
      {reserveError !== null && (
        <div role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warn">
          Reserve data unavailable: {reserveError}
        </div>
      )}

      {/* ---- Main content ---- */}
      {loansLoading ? (
        <Card><LoadingState label="Loading loan tape…" /></Card>
      ) : loansError !== null ? (
        <Card><ErrorState message={loansError} onRetry={reload} /></Card>
      ) : loans === null || loans.length === 0 ? (
        <Card><EmptyState label="No loans in the tape yet." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {loans.map((loan) => (
            <LoanOpsCard key={loan.id} loan={loan} reserve={effectiveReserve} />
          ))}
        </div>
      )}
    </section>
  );
}
