// The marketplace loan card — a first-lien mortgage at a glance · #24
// Shows principal, the per-second coupon, the mortgage ratios (LTV/DSCR), the loan status, the
// collateralType badge (the CRE/RESIDENTIAL seam), and a collapsible data room (static labels — no
// file fetch, per scope). The `actionSlot` is the mount point #25 fills with the Invest button so
// this component's structure is unchanged across tickets. Single loan per series, single class.
import { useState } from "react";
import type { ReactNode } from "react";
import type { Loan } from "../types.ts";
import { collateralTypeFor } from "../lib/collateral.ts";
import { fmtApy, fmtNetApy, fmtDscr, fmtLtv, fmtUsd6, INVESTOR_SHARE_BPS } from "../lib/format.ts";
import { Badge, Card, Modal, StatPill } from "./primitives.tsx";

// #24 loan status -> badge tone. Frozen is the row-9 NavAnomaly surface (accrual stopped).
const STATUS_TONE = { Active: "positive", Frozen: "halt", Matured: "neutral" } as const;

// #24 the static data-room doc list — labels only (appraisal, rent-roll, term sheet). No fetch.
const DATA_ROOM_DOCS = ["Appraisal report", "Rent roll", "Term sheet"] as const;

export function LoanCard(props: { loan: Loan; actionSlot?: ReactNode }): JSX.Element {
  const { loan } = props;
  const [open, setOpen] = useState(false);
  // #37 the data-room doc the viewer clicked (opens a stub modal); null when none is open.
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const collateral = collateralTypeFor(loan.id);
  // #46 the series' remaining subscription capacity (principal − subscribed, floored at 0 —
  // the projection can momentarily trail a pending invest). The on-chain cap is authoritative;
  // this is the same number ExceedsPrincipal enforces, surfaced before the attempt.
  const unsubscribed = loan.principal > loan.subscribed ? loan.principal - loan.subscribed : 0n;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Loan series</div>
          <div className="font-tabular text-lg font-semibold text-navy-900">#{loan.id}</div>
        </div>
        <div className="flex gap-2">
          <Badge tone={collateral === "RESIDENTIAL" ? "warn" : "navy"} title={`${collateral} collateral`}>
            {collateral}
          </Badge>
          <Badge tone={STATUS_TONE[loan.status]}>{loan.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatPill label="Principal" value={fmtUsd6(loan.principal)} tone="navy" />
        <StatPill
          label={
            <abbr title={`Net yield to you = ${fmtApy(loan.ratePerSecond)} gross loan coupon less the ${(10000 - INVESTOR_SHARE_BPS) / 100}% originator/servicer/platform spread`}>
              Net yield
            </abbr>
          }
          value={fmtNetApy(loan.ratePerSecond)}
          tone="navy"
        />
        <StatPill label={<abbr title="Loan-to-Value — loan amount as a % of the property's appraised value; lower is safer">LTV</abbr>} value={fmtLtv(loan.ltvBps)} />
        <StatPill label={<abbr title="Debt-Service Coverage Ratio — net operating income ÷ annual debt payments; above 1.0x means the property covers its own payments">DSCR</abbr>} value={fmtDscr(loan.dscrBps)} />
        <div className="col-span-2">
          <StatPill
            label={<abbr title="Principal not yet taken by investors — the series' remaining subscription capacity. Issuance past this reverts on-chain (ExceedsPrincipal).">Unsubscribed</abbr>}
            value={unsubscribed === 0n ? "Fully subscribed" : fmtUsd6(unsubscribed)}
            {...(unsubscribed === 0n ? { tone: "navy" as const } : {})}
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-sm font-medium text-navy-700 hover:underline"
        >
          {open ? "Hide data room" : "View data room"}
        </button>
        {open ? (
          <ul className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">
            {DATA_ROOM_DOCS.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => setActiveDoc(d)}
                  className="text-left text-navy-700 hover:underline"
                >
                  {d}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {props.actionSlot}

      {/* #37 data-room docs are sample stubs (no file fetch in scope) — clicking opens an honest
          explainer so the interaction completes instead of looking like a dead link. */}
      {activeDoc !== null ? (
        <Modal title={activeDoc} onClose={() => setActiveDoc(null)}>
          <p className="text-sm text-slate-600">
            Sample document for loan series #{loan.id}. In production the data room serves the gated{" "}
            <span className="font-medium text-slate-800">{activeDoc.toLowerCase()}</span> to verified, eligible
            investors only; here it is a stub to demonstrate the flow.
          </p>
        </Modal>
      ) : null}
    </Card>
  );
}
