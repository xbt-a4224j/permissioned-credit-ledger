// Servicing view — operator's servicing feed → validation gate → distribution · #38
// Queries all loans + the reserve state. Renders a global reserve panel (collected cash is one
// platform-wide value, reported once) and a LoanOpsCard per loan for the per-loan NAV gate.
// Read-only data path mirrors MarketplaceView (useQuery + loading/error/empty states).
import type { Loan, LoanId, LoanStatus } from "../types.ts";
import { LOANS_QUERY } from "../queries.ts";
import { useQuery } from "../lib/useQuery.ts";
import { gql } from "../lib/graphqlClient.ts";
import { REPORT_CASH_MUTATION } from "../lib/mutations.ts";
import { fmtUsd6 } from "../lib/format.ts";
import { useCallback, useEffect, useState } from "react";
import { LoanOpsCard } from "../components/LoanOpsCard.tsx";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, StatPill } from "../components/primitives.tsx";

// #38 the reserve coverage shape (mirrors api/schema.graphql ReserveState).
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

  // #38 reserve state: a single platform-wide value (collected cash vs aggregate claimable).
  // Errors are soft — the loan cards still render their per-loan NAV gate without it.
  const [reserve, setReserve] = useState<ReserveState | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const loadReserve = useCallback((): void => {
    gql<ReserveRaw>(RESERVE_QUERY)
      .then((raw) => {
        setReserve({ balance: BigInt(raw.reserve.balance), totalClaimable: BigInt(raw.reserve.totalClaimable) });
        setReserveError(null);
      })
      .catch((err: unknown) => setReserveError(err instanceof Error ? err.message : "Could not load reserve"));
  }, []);

  useEffect(() => { loadReserve(); }, [loadReserve]);

  // #38 report collected cash — a single global write (reserve is one row, not per-loan). The
  // mutation still takes a loanId for validation, so we pass the first loan in the tape.
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashResult, setCashResult] = useState<{ state: string; haltReason: string | null } | null>(null);
  const [cashError, setCashError] = useState<string | null>(null);

  async function handleReportCash(): Promise<void> {
    if (!cashAmount.trim()) { setCashError("Amount is required"); return; }
    const anchorLoanId = loans && loans[0] !== undefined ? Number(loans[0].id) : 1;
    setCashSubmitting(true);
    setCashResult(null);
    setCashError(null);
    try {
      const res = await gql<{ reportCash: { state: string; haltReason: string | null } }>(
        REPORT_CASH_MUTATION,
        { loanId: anchorLoanId, amount: cashAmount.trim() },
      );
      setCashResult(res.reportCash);
      loadReserve(); // reflect the new collected balance
    } catch (err) {
      setCashError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setCashSubmitting(false);
    }
  }

  const covered = reserve !== null && reserve.balance >= reserve.totalClaimable;

  return (
    <section aria-labelledby="loans-ops-heading">
      {/* ---- Header ---- */}
      <div className="mb-6">
        <h2 id="loans-ops-heading" className="text-xl font-semibold text-navy-900">Servicing</h2>
        <p className="text-sm text-slate-500">
          Servicer-side controls — report collected cash and mark each loan&rsquo;s NAV; these drive the reconciliation gate before any on-chain distribution.
        </p>
      </div>

      {/* ---- Global reserve panel (collected cash is one platform-wide value) ---- */}
      <Card className="mb-6 flex flex-col gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Reserve coverage</div>
          <p className="text-xs text-slate-400">Platform-wide servicing cash vs aggregate on-chain claimable — invariant I2.</p>
        </div>
        {reserveError !== null ? (
          <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warn">
            Reserve data unavailable: {reserveError}
          </div>
        ) : reserve === null ? (
          <LoadingState label="Loading reserve…" />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <StatPill label="Collected" value={fmtUsd6(reserve.balance)} tone="navy" />
            <StatPill label="Claimable" value={fmtUsd6(reserve.totalClaimable)} />
            <Badge tone={covered ? "positive" : "halt"}>{covered ? "Covered" : "Shortfall"}</Badge>
          </div>
        )}
        <div className="border-t border-slate-100 pt-4">
          <label htmlFor="report-cash" className="mb-1.5 block text-xs font-medium text-slate-700">
            Report collected cash <span className="font-normal text-slate-400">— USDC base units (6 decimals), sets the platform reserve</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="report-cash"
              type="text"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="e.g. 1000000000000 = 1,000,000 USDC"
              aria-label="Collected USDC amount in base units"
              className="w-72 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 font-tabular tabular-nums focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
            <Button onClick={() => { void handleReportCash(); }} disabled={cashSubmitting}>
              {cashSubmitting ? "Submitting…" : "Report"}
            </Button>
          </div>
          {cashResult !== null && (
            <p className={`mt-1.5 text-xs font-medium ${cashResult.state === "HALTED" ? "text-halt" : "text-positive"}`}>
              {cashResult.state}{cashResult.haltReason !== null ? ` — ${cashResult.haltReason}` : ""}
            </p>
          )}
          {cashError !== null && <p className="mt-1.5 text-xs font-medium text-halt">{cashError}</p>}
        </div>
      </Card>

      {/* ---- Per-loan NAV gate ---- */}
      {loansLoading ? (
        <Card><LoadingState label="Loading loan tape…" /></Card>
      ) : loansError !== null ? (
        <Card><ErrorState message={loansError} onRetry={reload} /></Card>
      ) : loans === null || loans.length === 0 ? (
        <Card><EmptyState label="No loans in the tape yet." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {loans.map((loan) => (
            <LoanOpsCard key={loan.id} loan={loan} />
          ))}
        </div>
      )}
    </section>
  );
}
