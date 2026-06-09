// Per-loan operator card — the NAV gate for a single loan · #38
// The operator's NAV controls for one loan: shows the current mark, NAV history, and the
// submitNav write path. NAV is per-loan; collected cash / reserve coverage is a single global
// value and lives in the LoansView reserve panel, not here. Each card fetches its own NAV
// readings so the list stays decoupled from a parent fetch cycle.
import { useState } from "react";
import type { Loan, LoanStatus } from "../types.ts";
import { collateralTypeFor } from "../lib/collateral.ts";
import { fmtUsd6, fmtLtv, fmtDscr, fmtApy } from "../lib/format.ts";
import { gql } from "../lib/graphqlClient.ts";
import { useQuery } from "../lib/useQuery.ts";
import { SUBMIT_NAV_MUTATION, NAV_READINGS_QUERY } from "../lib/mutations.ts";
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

export function LoanOpsCard(props: { loan: Loan }): JSX.Element {
  const { loan } = props;
  const collateral = collateralTypeFor(loan.id);

  // #38 NAV readings — fetch on mount so the history table is always fresh.
  const { loading: navLoading, data: navData } = useQuery<NavReadingsResponse, NavReadingRaw[]>(
    NAV_READINGS_QUERY,
    (r) => r.navReadings,
    { loanId: loan.id },
  );

  // #38 last accepted mark (newest first from the API, filter accepted).
  const lastAccepted = navData?.find((r) => r.accepted) ?? null;

  // ---- submitNav state ----
  const [navBps, setNavBps] = useState<string>("10000");
  const [navSubmitting, setNavSubmitting] = useState(false);
  const [navResult, setNavResult] = useState<OpsResult | null>(null);
  const [navError, setNavError] = useState<string | null>(null);

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
        <StatPill label={<abbr title="Loan-to-Value — loan amount as a % of the property's appraised value; lower is safer">LTV</abbr>} value={fmtLtv(loan.ltvBps)} />
        <StatPill label={<abbr title="Debt-Service Coverage Ratio — net operating income ÷ annual debt payments; above 1.0x means the property covers its own payments">DSCR</abbr>} value={fmtDscr(loan.dscrBps)} />
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
          <label htmlFor={`nav-${loan.id}`} className="mb-1.5 block text-xs font-medium text-slate-700">
            Submit NAV mark <span className="font-normal text-slate-400">— bps of par (10000 = 100%)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`nav-${loan.id}`}
              type="number"
              value={navBps}
              onChange={(e) => setNavBps(e.target.value)}
              placeholder="10000 = par"
              aria-label="NAV in basis points of par, where 10000 equals 100 percent"
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

      </div>
    </Card>
  );
}
