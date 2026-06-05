// Money Layer (presentation) · the shared primitive set — Card/StatPill/DataTable/Badge/Banner · #24
// The small reused vocabulary every view composes from, drawing on the design tokens (theme.ts):
// subtle borders over heavy shadows, generous padding, tabular money, navy/neutral tones. One
// primitive set keeps the four views visually identical in weight — bank-grade, not crypto-playful.
import type { ReactNode } from "react";
import type { Tone } from "../theme.ts";

// #24 tone -> tailwind classes for the pill/badge/banner family. `block`/`halt` are the typed
// failure tones (compliance revert vs engine HALT); kept distinct so a reviewer reads them apart.
const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  navy: "bg-navy-50 text-navy-800 border-navy-600/20",
  positive: "bg-green-50 text-positive border-green-200",
  warn: "bg-amber-50 text-warn border-amber-200",
  block: "bg-red-50 text-halt border-red-200",
  halt: "bg-halt text-white border-halt",
};

// #24 Card — the base surface. Subtle border + soft radius, no heavy shadow.
export function Card(props: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-6 ${props.className ?? ""}`}>{props.children}</div>
  );
}

// #24 StatPill — a labelled metric (LTV, DSCR, principal). Tabular numerics for aligned money.
export function StatPill(props: { label: string; value: ReactNode; tone?: Tone }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-slate-500">{props.label}</span>
      <span className={`font-tabular text-sm font-semibold ${props.tone === "navy" ? "text-navy-800" : "text-slate-900"}`}>
        {props.value}
      </span>
    </div>
  );
}

// #24 Badge — a small typed status pill (collateral type, loan status, reason code).
export function Badge(props: { children: ReactNode; tone?: Tone; title?: string }): JSX.Element {
  return (
    <span
      title={props.title}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[props.tone ?? "neutral"]}`}
    >
      {props.children}
    </span>
  );
}

// #24 Banner — a full-width status strip. The HALT banner (#26) reuses this with tone="halt".
export function Banner(props: { tone: Tone; title: string; children?: ReactNode }): JSX.Element {
  return (
    <div role="alert" className={`flex flex-col gap-1 rounded-md border px-4 py-3 ${TONE_CLASS[props.tone]}`}>
      <span className="text-sm font-semibold">{props.title}</span>
      {props.children !== undefined ? <span className="text-sm opacity-90">{props.children}</span> : null}
    </div>
  );
}

// #24 the clean state surfaces every view reuses (loading / error / empty). Calm and centered,
// never a blank screen — a bank-grade UI is explicit about every state.
export function LoadingState(props: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status" aria-live="polite">
      <span className="h-2 w-2 animate-pulse rounded-full bg-navy-600" />
      {props.label ?? "Loading…"}
    </div>
  );
}

export function ErrorState(props: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <span className="text-sm font-medium text-halt">Could not load data</span>
      <span className="max-w-md text-xs text-slate-500">{props.message}</span>
      {props.onRetry !== undefined ? (
        <button type="button" onClick={props.onRetry} className="rounded-md border border-slate-300 px-3 py-1 text-sm text-navy-700 hover:bg-slate-50">
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState(props: { label: string }): JSX.Element {
  return <div className="py-16 text-center text-sm text-slate-500">{props.label}</div>;
}

// #25 Modal — a centered dialog surface for the invest/transfer flows. role="dialog" + aria-modal
// + an Escape-to-close handler; a labelled title for assistive tech.
export function Modal(props: { title: string; onClose: () => void; children: ReactNode }): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900">{props.title}</h3>
          <button type="button" onClick={props.onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

// #25 Button — the primary/secondary action button (disabled with a tooltip when no wallet).
export function Button(props: { children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string | undefined; variant?: "primary" | "secondary"; type?: "button" | "submit" }): JSX.Element {
  const base = "rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
  const variant =
    props.variant === "secondary"
      ? "border border-slate-300 text-navy-700 hover:bg-slate-50"
      : "bg-navy-800 text-white hover:bg-navy-700";
  return (
    <button type={props.type ?? "button"} onClick={props.onClick} disabled={props.disabled} title={props.title} className={`${base} ${variant}`}>
      {props.children}
    </button>
  );
}

// #24 DataTable — a calm, data-dense table. Columns carry an optional `align` (money right-aligns).
export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

export function DataTable<T>(props: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; emptyLabel?: string; rowClass?: (row: T) => string }): JSX.Element {
  if (props.rows.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-slate-500">{props.emptyLabel ?? "No rows."}</div>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          {props.columns.map((c) => (
            <th key={c.key} className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={props.rowKey(row)} className={`border-b border-slate-100 ${props.rowClass?.(row) ?? ""}`}>
            {props.columns.map((c) => (
              <td
                key={c.key}
                className={`px-3 py-2 ${c.align === "right" ? "text-right font-tabular tabular-nums" : "text-left"}`}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
