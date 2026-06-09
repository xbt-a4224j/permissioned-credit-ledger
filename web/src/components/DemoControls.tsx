// Demo controls — trigger both HALT states through the real operator mutations · #33
// No demo-only backdoors: these buttons call the same submitNav / reportCash mutations the
// Servicing view uses. NavAnomaly: submit a 14000 bps (+40%) mark — the NAV gate rejects it as
// OutOfBounds and halts, the row-9 mechanism. ReconMismatch: read aggregate claimable from the
// reserve query and report collected cash one base unit below it — I2 ClaimableCovered breaks,
// the row-10 mechanism. If nothing is claimable yet (fresh world, no accrual), the cash trigger
// says so instead of faking a shortfall. The HALT banner + invariant grid update over SSE within
// one driver interval (#32). Reset with `bun run scripts/demo_reset.ts`.
import { useState } from "react";
import { Button, Card } from "./primitives.tsx";
import { gql, GraphqlCodeError } from "../lib/graphqlClient.ts";
import { SUBMIT_NAV_MUTATION, REPORT_CASH_MUTATION } from "../lib/mutations.ts";
import { logAction } from "../lib/actionLog.ts";

// #33 the demo always targets the seeded loan series #1 (the position that exists on a fresh world).
const DEMO_LOAN_ID = 1;
// #33 a +40% mark in bps of par — past the ±20% bound, so the gate rejects it (NavAnomaly).
const SPIKE_NAV_BPS = 14000;

// the reserve totals needed to compute a below-claimable cash report.
const RESERVE_TOTALS_QUERY = /* GraphQL */ `
  query ReserveTotals {
    reserve { totalClaimable }
  }
`;

type OpsStatus = { state: string; haltReason: string | null };

export function DemoControls(): JSX.Element {
  const [busy, setBusy] = useState<"nav" | "cash" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fire(kind: "nav" | "cash"): Promise<void> {
    setBusy(kind);
    setMessage(null);
    setError(null);
    try {
      let status: OpsStatus | undefined;
      if (kind === "nav") {
        const data = await gql<{ submitNav: OpsStatus }>(SUBMIT_NAV_MUTATION, { loanId: DEMO_LOAN_ID, navBps: SPIKE_NAV_BPS });
        status = data.submitNav;
      } else {
        // compute a shortfall from live aggregate claimable; refuse honestly when there is none.
        const totals = await gql<{ reserve: { totalClaimable: string } }>(RESERVE_TOTALS_QUERY);
        const claimable = BigInt(totals.reserve.totalClaimable);
        if (claimable === 0n) {
          setError("Nothing claimable yet — invest first so interest accrues, then retry.");
          return;
        }
        const shortfall = (claimable - 1n).toString();
        const data = await gql<{ reportCash: OpsStatus }>(REPORT_CASH_MUTATION, { loanId: DEMO_LOAN_ID, amount: shortfall });
        status = data.reportCash;
      }
      logAction({
        action: kind === "nav" ? "demo_nav_spike" : "demo_cash_shortfall",
        loanId: DEMO_LOAN_ID,
        result: status?.state === "HALTED" ? "halted" : "ok",
        reason: status?.haltReason ?? undefined,
      });
      setMessage(
        status?.state === "HALTED"
          ? `Engine HALTED — ${status.haltReason ?? "halt"} on loan #${DEMO_LOAN_ID}.`
          : `Triggered; the panel updates on the next reconciliation cycle.`,
      );
    } catch (err) {
      setError(err instanceof GraphqlCodeError ? `${err.message} (${err.code ?? "error"})` : (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-dashed">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-navy-900">Demo controls</div>
          <p className="text-xs text-slate-500">
            Trigger each HALT on loan series #{DEMO_LOAN_ID} via the real operator mutations. Reset afterwards with{" "}
            <code className="rounded bg-slate-100 px-1">bun run scripts/demo_reset.ts</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy !== null} onClick={() => void fire("nav")}>
            {busy === "nav" ? "Submitting…" : "Submit +40% NAV mark"}
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => void fire("cash")}>
            {busy === "cash" ? "Reporting…" : "Report cash below claimable"}
          </Button>
        </div>
      </div>
      {message !== null ? <p className="mt-3 text-sm text-navy-700">{message}</p> : null}
      {error !== null ? <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p> : null}
    </Card>
  );
}
