// the platform platform ops · per-loan operator card — NAV gate + servicing cash feed · #38
// The operator's controls for a single loan: shows the current mark, reserve coverage, NAV
// history, and two write paths (submitNav / reportCash). Each card is self-contained — it
// fetches its own NAV readings so the list stays decoupled from a parent fetch cycle.
import { useState } from "react";
import type { Loan, LoanStatus } from "../types.ts";
import type { ReserveState } from "../views/LoansView.tsx";
import { collateralTypeFor } from "../lib/collateral.ts";
import { fmtUsd6, fmtLtv, fmtDscr, fmtApy } from "../lib/format.ts";
import { gql } from "../lib/graphqlClient.ts";
import { useQuery } from "../lib/useQuery.ts";
import { SUBMIT_NAV_MUTATION, REPORT_CASH_MUTATION, NAV_READINGS_QUERY } from "../lib/mutations.ts";
import { Badge, Button, Card, LoadingState, StatPill } from "./primitives.tsx";

// #38 the recon-status shape returned by submitNav / reportCash mutations.
interface OpsResult {
  state: string;
  cycle: number;
  haltReason: string | null;
}

// #38 NAV reading wire shape from the navReadings query.
interface NavReadingRaw {
  id: string;
  navBps: number;
  observedAt: string;
  source: string;
  accepted: boolean;
  rejectReason: string | null;
}
interface NavReadingsResponse {
  navReadings: NavReadingRaw[];
}

// #38 loan-status -> badge tone (mirrors LoanCard's STATUS_TONE).
const STATUS_TONE: Record<LoanStatus, "positive" | "halt" | "neutral"> = {
  Active: "positive",
  Frozen: "halt",
  Matured: "neutral",
};

export function LoanOpsCard(props: { loan: Loan; reserve: ReserveState }): JSX.Element {
  const { loan, reserve } = props;
  const collateral = collateralTypeFor(loan.id);

  // #38 NAV readings — fetch on mount so the history table is always fresh.
  const { loading: navLoading, data: navData } = useQuery<NavReadingsResponse, NavReadingRaw[]>(
    NAV_READINGS_QUERY,
    (r) => r.navReadings,
    { loanId: loan.id },
  );

  // #38 last accepted mark (newest first from the API, filter accepted).
  const lastAccepted = navData?.find((r) => r.accepted) ?? null;

  // #38 reserve coverage: compare balance vs totalClaimable (both BigIntStr from wire, already bigint in prop).
  const covered = reserve.balance >= reserve.totalClaimable;

  // ---- submitNav state ----
  const [navBps, setNavBps] = useState<string>("10000");
  const [navSubmitting, setNavSubmitting] = useState(false);
  const [navResult, setNavResult] = useState<OpsResult | null>(null);
  const [navError, setNavError] = useState<string | null>(null);

  // ---- reportCash state ----
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashResult, setCashResult] = useState<OpsResult | null>(null);
  const [cashError, setCashError] = useState<string | null>(null);

  // #38 submitNav: parse navBps as int, call the mutation, surface the gate decision.
  async function handleSubmitNav(): Promise<void> {
    const bps = parseInt(navBps, 10);
    if (isNaN(bps)) { setNavError("navBps must be an integer"); return; }
    setNavSubmitting(true);
    setNavResult(null);
    setNavError(null);
    try {
      const res = await gql<{ submitNav: OpsResult }>(
        SUBMIT_NAV_MUTATION,
        { loanId: Number(loan.id), navBps: bps },
      );
      setNavResult(res.submitNav);
    } catch (err) {
      setNavError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setNavSubmitting(false);
    }
  }

  // #38 reportCash: pass amount as string (BigIntStr base units), call the mutation.
  async function handleReportCash(): Promise<void> {
    if (!cashAmount.trim()) { setCashError("Amount is required"); return; }
    setCashSubmitting(true);
    setCashResult(null);
    setCashError(null);
    try {
      const res = await gql<{ reportCash: OpsResult }>(
        REPORT_CASH_MUTATION,
        { loanId: Number(loan.id), amount: cashAmount.trim() },
      );
      setCashResult(res.reportCash);
    } catch (err) {
      setCashError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setCashSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Loan series</div>
          <div className="font-tabular text-lg font-semibold text-navy-900">#{loan.id}</div>
        </div>
        <div className="flex gap-2">
          <Badge
            tone={collateral === "RESIDENTIAL" ? "warn" : "navy"}
            title={`${collateral} collateral`}
          >
            {collateral}
          </Badge>
          <Badge tone={STATUS_TONE[loan.status]}>{loan.status}</Badge>
        </div>
      </div>

      {/* ---- Stats row ---- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatPill label="Principal" value={fmtUsd6(loan.principal)} tone="navy" />
        <StatPill label="APY" value={fmtApy(loan.ratePerSecond)} />
        <StatPill label="LTV" value={fmtLtv(loan.ltvBps)} />
        <StatPill label="DSCR" value={fmtDscr(loan.dscrBps)} />
      </div>

      {/* ---- Current NAV mark ---- */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Current NAV mark</div>
        {lastAccepted !== null ? (
          <span className="font-tabular text-sm font-semibold text-navy-900 tabular-nums">
            {/* #38 navBps / 100 renders 10000 bps as 100.00% of par */}
            {(lastAccepted.navBps / 100).toFixed(2)}% of par
          </span>
        ) : (
          <span className="text-sm text-slate-400">No mark submitted yet</span>
        )}
      </div>

      {/* ---- Reserve coverage ---- */}
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Reserve coverage</div>
        <div className="flex flex-wrap items-center gap-4">
          <StatPill label="Collected" value={fmtUsd6(reserve.balance)} tone="navy" />
          <StatPill label="Claimable" value={fmtUsd6(reserve.totalClaimable)} />
          <Badge tone={covered ? "positive" : "halt"}>
            {covered ? "Covered" : "Shortfall"}
          </Badge>
        </div>
      </div>

      {/* ---- NAV history table ---- */}
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">NAV history</div>
        {navLoading ? (
          <LoadingState label="Loading NAV readings…" />
        ) : navData === null || navData.length === 0 ? (
          <p className="text-sm text-slate-400">No NAV readings recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1.5 font-medium">Date</th>
                  <th className="px-2 py-1.5 font-medium">Source</th>
                  <th className="px-2 py-1.5 font-medium text-right">NAV</th>
                  <th className="px-2 py-1.5 font-medium text-center">Accepted</th>
                </tr>
              </thead>
              <tbody>
                {navData.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    {/* #38 observedAt is an ISO-8601 string; toLocaleDateString is sufficient for ops */}
                    <td className="px-2 py-1.5 text-slate-700">{new Date(r.observedAt).toLocaleDateString()}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.source}</td>
                    <td className="px-2 py-1.5 text-right font-tabular tabular-nums text-slate-900">
                      {(r.navBps / 100).toFixed(2)}%
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {r.accepted ? (
                        <span className="text-positive font-medium">&#10003;</span>
                      ) : (
                        <span className="text-halt font-medium" title={r.rejectReason ?? undefined}>&#10007;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Ops controls ---- */}
      <div className="flex flex-col gap-4 border-t border-slate-100 pt-4">

        {/* Submit NAV mark */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-slate-700">Submit NAV mark</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={navBps}
              onChange={(e) => setNavBps(e.target.value)}
              placeholder="bps, 10000=par"
              aria-label="NAV in basis points"
              className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 font-tabular tabular-nums focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
            <Button onClick={() => { void handleSubmitNav(); }} disabled={navSubmitting}>
              {navSubmitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
          {/* #38 show gate decision: HALTED in red, OK in green, error in red */}
          {navResult !== null && (
            <p className={`mt-1.5 text-xs font-medium ${navResult.state === "HALTED" ? "text-halt" : "text-positive"}`}>
              {navResult.state}{navResult.haltReason !== null ? ` — ${navResult.haltReason}` : ""}
            </p>
          )}
          {navError !== null && <p className="mt-1.5 text-xs font-medium text-halt">{navError}</p>}
        </div>

        {/* Report collected cash */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-slate-700">Report collected cash</div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="USDC amount (base units)"
              aria-label="USDC amount in base units"
              className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 font-tabular tabular-nums focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
            <Button onClick={() => { void handleReportCash(); }} disabled={cashSubmitting}>
              {cashSubmitting ? "Submitting…" : "Report"}
            </Button>
          </div>
          {/* #38 same gate-decision display: HALTED red, OK green */}
          {cashResult !== null && (
            <p className={`mt-1.5 text-xs font-medium ${cashResult.state === "HALTED" ? "text-halt" : "text-positive"}`}>
              {cashResult.state}{cashResult.haltReason !== null ? ` — ${cashResult.haltReason}` : ""}
            </p>
          )}
          {cashError !== null && <p className="mt-1.5 text-xs font-medium text-halt">{cashError}</p>}
        </div>

      </div>
    </Card>
  );
}
