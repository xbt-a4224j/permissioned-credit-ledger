// Servicing feed ticker — the off-chain firehose, live · #73
// Streams the warehouse's servicing events over SSE (the off-chain truth the reconciliation engine
// reconciles against). Connects directly to the Java sidecar (VITE_WAREHOUSE_URL, default :47100),
// which sends CORS headers for the web origin. Display only — a live pulse, an event count, and the
// last dozen events colour-coded by kind.
import { useEffect, useRef, useState } from "react";
import { Card } from "./primitives.tsx";

const WAREHOUSE_URL = (import.meta.env.VITE_WAREHOUSE_URL as string | undefined) ?? "http://localhost:47100";

interface ServicingEvent {
  seq: number;
  loanId: string;
  kind: string;
  amount: number | null;
  at: string;
}

const KIND_META: Record<string, { label: string; dot: string }> = {
  PAYMENT_POSTED: { label: "Payment", dot: "bg-emerald-500" },
  NAV_MARK: { label: "NAV mark", dot: "bg-slate-400" },
  ESCROW_DRAW: { label: "Escrow draw", dot: "bg-amber-400" },
  DELINQUENCY_FLIP: { label: "Delinquency", dot: "bg-halt" },
  PAYOFF: { label: "Payoff", dot: "bg-navy-600" },
};

const usd = (n: number): string => `$${Math.round(n).toLocaleString()}`;

export function ServicingTicker(): JSX.Element {
  const [events, setEvents] = useState<ServicingEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    const es = new EventSource(`${WAREHOUSE_URL}/servicing/stream`);
    es.onopen = (): void => setConnected(true);
    es.onerror = (): void => setConnected(false);
    es.addEventListener("servicing", (e: Event): void => {
      try {
        const ev = JSON.parse((e as MessageEvent).data as string) as ServicingEvent;
        setEvents((prev) => [ev, ...prev].slice(0, 12));
        countRef.current += 1;
        setCount(countRef.current);
      } catch {
        /* ignore a malformed frame */
      }
    });
    return () => es.close();
  }, []);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-navy-900">Servicing feed</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`inline-block h-2 w-2 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-slate-300"}`} />
          <span className="font-tabular tabular-nums">{count.toLocaleString()} events</span>
        </div>
      </div>
      {/* #73 column headers — institutional data-table chrome. */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span className="h-2 w-2 shrink-0" aria-hidden="true" />
        <span className="w-24 shrink-0">Event</span>
        <span className="flex-1">Loan</span>
        <span className="w-28 shrink-0 text-right">Amount</span>
      </div>
      {events.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">Waiting for servicing events…</div>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {events.map((ev) => {
            const meta = KIND_META[ev.kind] ?? { label: ev.kind, dot: "bg-slate-400" };
            return (
              <li key={ev.seq} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                <span className="w-24 shrink-0 text-slate-700">{meta.label}</span>
                <span className="flex-1 truncate font-tabular text-xs text-slate-500">{ev.loanId}</span>
                <span className="w-28 shrink-0 text-right font-tabular tabular-nums text-slate-700">{ev.amount !== null ? usd(ev.amount) : "—"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
