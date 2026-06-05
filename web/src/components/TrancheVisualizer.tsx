// Structuring module · the tranche waterfall visualizer — the money shot · #38
// Renders the seeded $1M pool as three stacked tranche bars (senior on top, junior at the bottom).
// Two live sliders — annual income and annual losses — recompute the pure waterfall engine on every
// drag. INCOME fills coupons top-down (a green fill rises through senior → mezz → junior); LOSSES
// eat principal bottom-up (the junior bar shrinks/reddens first). Everything is SVG + CSS transitions
// so it animates buttery-smooth with zero dependencies. No chain, no network — pure + deterministic.
import { useState } from "react";
import { runWaterfall, DEMO_POOL } from "../lib/waterfall.ts";

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// tranche tones: senior = safe green, mezz = amber, junior = red (first-loss).
const TONE = ["#1f7a5a", "#b06a00", "#d23b3b"];
const FILL = ["#eaf5ef", "#fbf3da", "#fdecec"];

export function TrancheVisualizer(): JSX.Element {
  const [income, setIncome] = useState(90_000);
  const [loss, setLoss] = useState(0);
  const r = runWaterfall(DEMO_POOL, income, loss);

  // geometry
  const W = 900, H = 300, x0 = 200, barW = 460, top = 30, gap = 14;
  const maxPrincipal = Math.max(...DEMO_POOL.tranches.map((t) => t.principal));
  const barH = (H - top - gap * 2) / 3;
  // width of a bar scales with original principal (senior is widest)
  const widthOf = (p: number) => 120 + (barW - 120) * (p / maxPrincipal);

  const halted = r.unpaidCoupon > 0 || r.tranches.some((t) => t.lossAbsorbed > 0);
  const verdict =
    loss > 0 && r.tranches.some((t) => t.lossAbsorbed > 0)
      ? `Losses absorbed bottom-up — junior is the first-loss buffer that keeps senior safe.`
      : r.unpaidCoupon > 0
      ? `Income shortfall — senior is paid first; junior earns nothing.`
      : `Good year — coupons paid in full, the equity tranche keeps the fat residual.`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <rect width="100%" height="100%" fill="#fff" />
        {/* the income stream label */}
        <text x={x0 + barW / 2} y={18} textAnchor="middle" fontSize="12" fill="#5a6472">
          income fills coupons top-down ↓ · losses eat principal bottom-up ↑
        </text>
        {DEMO_POOL.tranches.map((t, i) => {
          const tr = r.tranches[i]!;
          const y = top + i * (barH + gap);
          const fullW = widthOf(t.principal);
          const survW = fullW * (tr.principalAfterLoss / t.principal || 0);
          // coupon fill = fraction of coupon paid
          const couponFrac = tr.couponDue > 0 ? tr.couponPaid / tr.couponDue : tr.residual > 0 ? 1 : 0;
          return (
            <g key={t.name}>
              {/* written-off principal (ghost) */}
              <rect x={x0} y={y} width={fullW} height={barH} rx="7" fill="#f3f4f6" stroke="#e3e7ef" />
              {/* surviving principal */}
              <rect x={x0} y={y} width={survW} height={barH} rx="7" fill={FILL[i]} stroke={TONE[i]} strokeWidth={2}
                style={{ transition: "width .45s cubic-bezier(.4,0,.2,1)" }} />
              {/* coupon-paid fill (a brighter band rising from the left) */}
              <rect x={x0} y={y + barH - 7} width={survW * couponFrac} height={5} rx="2" fill={TONE[i]}
                style={{ transition: "width .45s cubic-bezier(.4,0,.2,1)" }} />
              {/* labels */}
              <text x={x0 + 12} y={y + 22} fontSize="13" fontWeight={700} fill={TONE[i]}>{t.name}</text>
              <text x={x0 + 12} y={y + 39} fontSize="10.5" fill="#5a6472">
                {usd(tr.principalAfterLoss)}{tr.lossAbsorbed > 0 ? ` (−${usd(tr.lossAbsorbed)})` : ""}{t.equity ? " · equity" : ` @ ${pct(t.rate)}`}
              </text>
              {/* right-side: cash to tranche + realized yield */}
              <text x={x0 + barW + 130} y={y + 20} textAnchor="end" fontSize="13" fontWeight={700} fill={TONE[i]}>
                {usd(tr.cashToTranche)}
              </text>
              <text x={x0 + barW + 130} y={y + 37} textAnchor="end" fontSize="10.5" fill="#5a6472">
                {tr.equity ? "residual" : "coupon"} · yield {pct(tr.yieldOnPrincipal)}
              </text>
              {/* loss flag */}
              {tr.principalAfterLoss === 0 && tr.principal > 0 ? (
                <text x={x0 + fullW - 10} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" fontWeight={700} fill="#d23b3b">WIPED ✗</text>
              ) : null}
            </g>
          );
        })}
        {/* priority arrows down the left */}
        <text x={x0 - 16} y={top + 10} textAnchor="end" fontSize="9.5" fill="#5a6472">senior</text>
        <text x={x0 - 16} y={H - 18} textAnchor="end" fontSize="9.5" fill="#5a6472">junior</text>
        <line x1={x0 - 30} y1={top} x2={x0 - 30} y2={H - 12} stroke="#cdd3df" strokeWidth="1.5" markerEnd="url(#dn)" />
        <defs><marker id="dn" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto"><path d="M0,0 L4,6 L8,0" fill="none" stroke="#cdd3df" strokeWidth="1.3" /></marker></defs>
      </svg>

      {/* controls */}
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <div className="mb-1 flex justify-between"><span className="font-medium text-slate-700">Annual income</span><span className="font-tabular tabular-nums text-emerald-700">{usd(income)}</span></div>
          <input type="range" min={0} max={120_000} step={1_000} value={income} onChange={(e) => setIncome(Number(e.target.value))} className="w-full accent-emerald-600" />
        </label>
        <label className="text-sm">
          <div className="mb-1 flex justify-between"><span className="font-medium text-slate-700">Annual losses (defaults)</span><span className="font-tabular tabular-nums text-rose-700">{usd(loss)}</span></div>
          <input type="range" min={0} max={250_000} step={1_000} value={loss} onChange={(e) => setLoss(Number(e.target.value))} className="w-full accent-rose-600" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => { setIncome(90_000); setLoss(0); }} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">Good year</button>
        <button type="button" onClick={() => { setIncome(50_000); setLoss(100_000); }} className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">Bad year (−$100k)</button>
        <button type="button" onClick={() => { setIncome(30_000); setLoss(0); }} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">Income shortfall</button>
      </div>
      <p className={`mt-3 text-sm ${halted ? "text-rose-700" : "text-slate-600"}`}>{verdict}</p>
    </div>
  );
}
