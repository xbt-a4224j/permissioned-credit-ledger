// #40 the lifecycle strip — a tight, always-visible footer that shows the end-to-end sequence at a
// glance: verify → invest → accrue → claim → reconcile. Institutional, no emojis; the reconcile step
// carries the punchline (the system halts rather than paying out value it can't prove is backed).

interface Step {
  n: number;
  label: string;
  sub: string;
  tone: "navy" | "ok" | "halt";
}

const STEPS: Step[] = [
  { n: 1, label: "Verify", sub: "KYC / KYB — eligible wallets only", tone: "navy" },
  { n: 2, label: "Invest", sub: "mint through the compliance gauntlet", tone: "navy" },
  { n: 3, label: "Accrue", sub: "yield ticks per second, on-chain", tone: "navy" },
  { n: 4, label: "Claim", sub: "paid from the reserve, on demand", tone: "ok" },
  { n: 5, label: "Reconcile", sub: "cash = claimable each cycle, or HALT", tone: "halt" },
];

const CHIP: Record<Step["tone"], string> = {
  navy: "bg-navy-800 text-white",
  ok: "bg-emerald-600 text-white",
  halt: "bg-rose-600 text-white",
};

export function Lifecycle(): JSX.Element {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">How it works</h2>
          <p className="text-xs text-slate-400">off-chain servicing cash, proven equal to on-chain claimable — every cycle</p>
        </div>
        <ol className="flex flex-wrap items-stretch gap-1">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex flex-1 items-center gap-1" style={{ minWidth: "150px" }}>
              <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${CHIP[s.tone]}`}>
                    {s.n}
                  </span>
                  <span className="text-sm font-semibold text-navy-900">{s.label}</span>
                </div>
                <div className="mt-1 text-xs leading-snug text-slate-500">{s.sub}</div>
              </div>
              {i < STEPS.length - 1 ? <span aria-hidden="true" className="px-0.5 text-slate-300">→</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-semibold text-rose-700">Reconciliation is a gate, not a report.</span>{" "}
          It sits in front of every payout and halts the instant the two ledgers disagree — the system fails loud, on purpose.
        </p>
      </div>
    </footer>
  );
}
