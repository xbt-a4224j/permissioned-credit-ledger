// Reserve ledger panel — the reserve as an append-only ledger, live · #82
// Polls reserveLedger every 2s (matching the reserve-coverage poll above it) and renders the recent
// credits/debits with their running balance as a column-labelled data table. The balance the
// reconciliation engine reads (the Collected stat above) is kept equal to the running sum here, so
// this is the audit trail behind that single coverage number. Display only.
import { useCallback, useEffect, useState } from "react";
import { gql } from "../lib/graphqlClient.ts";
import { fmtUsd6 } from "../lib/format.ts";
import { Card, LoadingState } from "./primitives.tsx";

interface ReserveLedgerEntry {
  id: string;
  entryType: "credit" | "debit";
  amount: string;
  reason: string;
  loanId: string | null;
  balanceAfter: string | null;
}

interface ReserveLedgerRaw {
  reserveLedger: ReserveLedgerEntry[];
}

const RESERVE_LEDGER_QUERY = /* GraphQL */ `
  query ReserveLedger {
    reserveLedger(limit: 12) {
      id
      entryType
      amount
      reason
      loanId
      balanceAfter
    }
  }
`;

// #82 raw reason (the DB text) → short human label for the row.
const REASON_LABEL: Record<string, string> = {
  "servicing collection": "Collection",
  "initial funding": "Initial funding",
  "interest claim": "Claim",
  "operator report": "Operator report",
};

export function ReserveLedgerPanel(): JSX.Element {
  const [entries, setEntries] = useState<ReserveLedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((): void => {
    gql<ReserveLedgerRaw>(RESERVE_LEDGER_QUERY)
      .then((raw) => {
        setEntries(raw.reserveLedger);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load reserve ledger"));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Card className="p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-navy-900">Reserve activity</div>
        <p className="text-xs text-slate-400">Append-only ledger of reserve credits and debits.</p>
      </div>
      {/* #82 column headers — institutional data-table chrome. */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span className="h-2 w-2 shrink-0" aria-hidden="true" />
        <span className="w-28 shrink-0">Type</span>
        <span className="w-12 shrink-0">Loan</span>
        <span className="ml-auto w-32 shrink-0 text-right">Amount</span>
        <span className="w-28 shrink-0 text-right">Balance</span>
      </div>
      {error !== null ? (
        <div role="alert" className="px-4 py-6 text-center text-sm text-warn">Ledger unavailable: {error}</div>
      ) : entries === null ? (
        <div className="px-4 py-6"><LoadingState label="Loading reserve ledger…" /></div>
      ) : entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">No reserve activity yet.</div>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {entries.map((e) => {
            const credit = e.entryType === "credit";
            const label = REASON_LABEL[e.reason] ?? e.reason;
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${credit ? "bg-emerald-500" : "bg-halt"}`} aria-hidden="true" />
                <span className="w-28 shrink-0 text-slate-700">{label}</span>
                <span className="w-12 shrink-0 font-tabular text-xs text-slate-500">{e.loanId !== null ? `#${e.loanId}` : ""}</span>
                <span className={`ml-auto w-32 shrink-0 text-right font-tabular tabular-nums ${credit ? "text-positive" : "text-halt"}`}>
                  {credit ? "+" : "−"}{fmtUsd6(BigInt(e.amount))}
                </span>
                <span className="w-28 shrink-0 text-right font-tabular tabular-nums text-xs text-slate-400">
                  {e.balanceAfter !== null ? fmtUsd6(BigInt(e.balanceAfter)) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
