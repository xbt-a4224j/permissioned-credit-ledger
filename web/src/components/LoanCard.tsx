// Asset Layer (presentation) · the marketplace loan card — a first-lien mortgage at a glance · #24
// Shows principal, the per-second coupon, the mortgage ratios (LTV/DSCR), the loan status, the
// collateralType badge (the CRE/RESIDENTIAL seam), and a collapsible data room (static labels — no
// file fetch, per scope). The `actionSlot` is the mount point #25 fills with the Invest button so
// this component's structure is unchanged across tickets. Single loan per series; no tranche picker.
import { useState } from "react";
import type { ReactNode } from "react";
import type { Loan } from "../types.ts";
import { collateralTypeFor } from "../lib/collateral.ts";
import { fmtDscr, fmtLtv, fmtUsd6 } from "../lib/format.ts";
import { Badge, Card, StatPill } from "./primitives.tsx";

// #24 loan status -> badge tone. Frozen is the row-9 NavAnomaly surface (accrual stopped).
const STATUS_TONE = { Active: "positive", Frozen: "halt", Matured: "neutral" } as const;

// #24 the static data-room doc list — labels only (appraisal, rent-roll, term sheet). No fetch.
const DATA_ROOM_DOCS = ["Appraisal report", "Rent roll", "Term sheet"] as const;

export function LoanCard(props: { loan: Loan; actionSlot?: ReactNode }): JSX.Element {
  const { loan } = props;
  const [open, setOpen] = useState(false);
  const collateral = collateralTypeFor(loan.id);

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
        <StatPill label="Coupon / sec" value={fmtUsd6(loan.ratePerSecond)} />
        <StatPill label="LTV" value={fmtLtv(loan.ltvBps)} />
        <StatPill label="DSCR" value={fmtDscr(loan.dscrBps)} />
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
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {props.actionSlot}
    </Card>
  );
}
