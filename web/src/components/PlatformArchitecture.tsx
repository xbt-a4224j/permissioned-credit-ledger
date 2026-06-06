// Platform thesis (presentation) · the shared-core + pluggable-modules + take-rate map · #42
// The one artifact that makes the platform/infrastructure thesis undeniable on a single screen:
// a SHARED CORE (build-once regulated plumbing) with ASSET MODULES plugged on top, plus the ranked
// TAKE-RATE economics. Data-driven, additive, touches nothing in the bulletproof core path. This is
// "reframe, don't build" — every claim here is already true of the system; this just shows it.

// #42 the build-once regulated plumbing every asset reuses (all live in this demo).
const SHARED_CORE = [
  "KYC / identity",
  "Compliance gauntlet (Reg D/S)",
  "Custody / signer",
  "Cap-table / indexer",
  "USDC distribution + SSE",
  "Reconciliation gate",
] as const;

type ModuleStatus = "live" | "viz" | "phase-2";
// #42 asset-specific modules that plug onto the same core. Status is honest: live / off-chain-model / planned.
const MODULES: { name: string; sub: string; status: ModuleStatus }[] = [
  { name: "CRE single-loan", sub: "iBorrow bridge — today", status: "live" },
  { name: "Residential", sub: "same rails, collateral flips", status: "live" },
  { name: "Tranche waterfall", sub: "structuring (off-chain model)", status: "viz" },
  { name: "Borrow-against", sub: "the keystone — phase-2", status: "phase-2" },
  { name: "Venture / fund", sub: "Republic leg — phase-2", status: "phase-2" },
];

// #42 the ranked take-rate stack (the economics). `seen` = visible in this demo's flows.
const REVENUE: { line: string; note: string; seen: boolean }[] = [
  { line: "Net-interest spread", note: "biggest — borrower rate ▸ investor coupon", seen: true },
  { line: "Borrow-against NIM", note: "keystone upside — a 2nd margin on the same loan", seen: false },
  { line: "White-label / tokenization-as-a-service", note: "future scale — rent the rails to non-QM originators", seen: false },
  { line: "Origination points · servicing · issuance", note: "per-deal + recurring fees", seen: true },
  { line: "Secondary trading", note: "deliberately small — a toll, not the thesis", seen: false },
];

const TAG: Record<ModuleStatus, { label: string; cls: string }> = {
  live: { label: "live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  viz: { label: "model", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  "phase-2": { label: "phase-2", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export function PlatformArchitecture(): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-navy-900">Platform architecture</div>
      <p className="mt-0.5 text-xs text-slate-500">
        One compliant securities core, built once; asset modules plug on top. It's a take-rate
        <span className="font-medium text-slate-700"> infrastructure</span> business, not a single-asset lender.
      </p>

      {/* asset modules — plugged on top */}
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-violet-700">Pluggable asset modules</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MODULES.map((m) => (
          <div key={m.name} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-navy-900">{m.name}</span>
              <span className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-medium ${TAG[m.status].cls}`}>{TAG[m.status].label}</span>
            </div>
            <div className="mt-1 text-[10px] leading-tight text-slate-500">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* the seam */}
      <div className="my-2 text-center text-[10px] text-slate-400">▲ each module = origination + servicing + waterfall, plugged onto ▼</div>

      {/* shared core — the base */}
      <div className="rounded-lg border-2 border-navy-700/30 bg-navy-50/40 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-navy-800">Shared core — built once (all live)</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SHARED_CORE.map((c) => (
            <span key={c} className="rounded border border-navy-600/30 bg-white px-2 py-1 text-[11px] font-medium text-navy-800">{c}</span>
          ))}
        </div>
      </div>

      {/* the economics */}
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Take-rate economics — ranked</div>
      <ol className="mt-2 space-y-1">
        {REVENUE.map((r, i) => (
          <li key={r.line} className="flex items-baseline gap-2 text-xs">
            <span className="font-tabular tabular-nums text-slate-400">{i + 1}</span>
            <span className="font-medium text-slate-800">{r.line}</span>
            <span className="text-slate-400">— {r.note}</span>
            {r.seen ? <span className="ml-auto shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1 text-[9px] font-medium text-emerald-700">in demo</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
