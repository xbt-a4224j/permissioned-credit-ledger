// #39 action log panel — polls GET /logs and renders a reverse-chronological feed of every
// user/product action (invest, claim, transfer, identity switch, demo triggers, tab navigation).
import { useEffect, useRef, useState } from "react";
import { Card } from "./primitives.tsx";

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:41990/graphql").replace(/\/graphql\/?$/, "");

interface LogEntry {
  ts: string;
  action: string;
  actor?: string;
  loanId?: string | number;
  result?: "ok" | "rejected" | "halted" | "error";
  reason?: string;
  view?: string;
  [key: string]: unknown;
}

const RESULT_CLASS: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-amber-50 text-amber-700 border-amber-200",
  halted: "bg-rose-50 text-rose-700 border-rose-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
};

const ACTION_LABEL: Record<string, string> = {
  invest: "Invest",
  claim: "Claim",
  transfer: "Transfer",
  identity_switch: "Identity",
  view_change: "Navigate",
  demo_push_nav: "Push NAV",
  demo_inject_cash: "Inject cash",
  submit_nav: "Submit NAV",
  report_cash: "Report cash",
};

function summary(e: LogEntry): string {
  if (e.action === "identity_switch") return `switched to ${e.actor ? `${String(e.actor).slice(0, 6)}…${String(e.actor).slice(-4)}` : "?"}`;
  if (e.action === "view_change") return `→ ${String(e.view ?? "?")}`;
  if (e.loanId !== undefined) return `loan #${e.loanId}${e.reason ? ` · ${e.reason}` : ""}`;
  return e.reason ?? "";
}

function timeLabel(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return ts; }
}

export function ActionLog(): JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/logs?limit=50`);
        const data = await res.json() as LogEntry[];
        if (alive) { setEntries(data); setError(false); }
      } catch {
        if (alive) setError(true);
      }
      if (alive) timerRef.current = setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      alive = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-navy-900">Activity log</div>
        <div className="text-xs text-slate-400">
          {error ? <span className="text-rose-600">feed error</span> : `${entries.length} entries`}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          No actions yet — interact with the app to see the log.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2">
              <span className="shrink-0 w-18 font-tabular text-xs tabular-nums text-slate-400">
                {timeLabel(e.ts)}
              </span>
              <span className="shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 border-slate-200">
                {ACTION_LABEL[e.action] ?? e.action}
              </span>
              <span className="flex-1 truncate text-sm text-slate-700">{summary(e)}</span>
              {e.result !== undefined ? (
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${RESULT_CLASS[e.result] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {e.result}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
