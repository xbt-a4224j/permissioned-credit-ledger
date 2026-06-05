// Structuring module · the tranche waterfall engine — pure, deterministic, tested · #38
// The generalization of the platform's single-class distribution: instead of one pari-passu class,
// a pool's cash flows are split into priority tranches. INCOME pays coupons top-down (senior first);
// LOSSES write down principal bottom-up (junior/first-loss first). This is the same "priority of
// payments" primitive a real securitization (and a fund's carry waterfall) runs — encoded as a pure
// function so the visualizer can recompute it live and a test can pin every edge. No chain, no IO.

export interface Tranche {
  name: string;
  /** original principal in whole USD */
  principal: number;
  /** annual coupon rate (e.g. 0.06 = 6%); the junior/equity tranche takes the residual, rate ignored */
  rate: number;
  /** true for the residual/equity tranche (paid last, absorbs first loss) */
  equity?: boolean;
}

export interface Pool {
  name: string;
  /** ordered senior → … → junior (first element is most senior) */
  tranches: Tranche[];
}

export interface TrancheResult {
  name: string;
  principal: number;
  /** principal remaining after losses are absorbed bottom-up */
  principalAfterLoss: number;
  /** principal written off by losses */
  lossAbsorbed: number;
  /** coupon contractually owed this period (on surviving principal) */
  couponDue: number;
  /** coupon actually paid from available income (top-down) */
  couponPaid: number;
  /** residual income kept by the equity tranche (0 for debt tranches) */
  residual: number;
  /** total cash to this tranche = couponPaid + residual */
  cashToTranche: number;
  /** realized period yield on original principal */
  yieldOnPrincipal: number;
  equity: boolean;
}

export interface WaterfallResult {
  income: number;
  loss: number;
  tranches: TrancheResult[];
  /** income that couldn't be paid out (shortfall absorbed by missing coupons) */
  unpaidCoupon: number;
}

// #38 run one period: apply `loss` (bottom-up principal write-down) then distribute `income`
// (top-down coupons, equity keeps the residual). All amounts in whole USD.
export function runWaterfall(pool: Pool, income: number, loss: number): WaterfallResult {
  const n = pool.tranches.length;
  const principalAfterLoss = pool.tranches.map((t) => t.principal);

  // 1. losses fill UP from the most-junior tranche (last) toward senior (first).
  let remainingLoss = Math.max(0, loss);
  for (let i = n - 1; i >= 0 && remainingLoss > 0; i--) {
    const absorb = Math.min(principalAfterLoss[i]!, remainingLoss);
    principalAfterLoss[i]! -= absorb;
    remainingLoss -= absorb;
  }

  // 2. coupons are owed on SURVIVING principal; equity tranche has no coupon.
  const couponDue = pool.tranches.map((t, i) => (t.equity ? 0 : principalAfterLoss[i]! * t.rate));

  // 3. income pays coupons top-down (senior first); whatever's left is the equity residual.
  let remainingIncome = Math.max(0, income);
  const couponPaid = couponDue.map(() => 0);
  for (let i = 0; i < n; i++) {
    const pay = Math.min(couponDue[i]!, remainingIncome);
    couponPaid[i] = pay;
    remainingIncome -= pay;
  }
  const unpaidCoupon = couponDue.reduce((s, d, i) => s + (d - couponPaid[i]!), 0);

  // the equity tranche (or, if none flagged, the last tranche) keeps the residual income.
  const equityIdx = pool.tranches.findIndex((t) => t.equity);
  const residualIdx = equityIdx >= 0 ? equityIdx : n - 1;

  const tranches: TrancheResult[] = pool.tranches.map((t, i) => {
    const residual = i === residualIdx ? remainingIncome : 0;
    const cash = couponPaid[i]! + residual;
    return {
      name: t.name,
      principal: t.principal,
      principalAfterLoss: principalAfterLoss[i]!,
      lossAbsorbed: t.principal - principalAfterLoss[i]!,
      couponDue: couponDue[i]!,
      couponPaid: couponPaid[i]!,
      residual,
      cashToTranche: cash,
      yieldOnPrincipal: t.principal > 0 ? cash / t.principal : 0,
      equity: i === residualIdx,
    };
  });

  return { income: Math.max(0, income), loss: Math.max(0, loss), tranches, unpaidCoupon };
}

// #38 the seeded demo pool: a $1M CRE-credit pool sliced into three tranches. Mirrors the worked
// example in the domain guide so the visualizer and the study material agree.
export const DEMO_POOL: Pool = {
  name: "CRE credit pool — $1,000,000",
  tranches: [
    { name: "Senior", principal: 800_000, rate: 0.06 },
    { name: "Mezzanine", principal: 150_000, rate: 0.1 },
    { name: "Junior / equity", principal: 50_000, rate: 0, equity: true },
  ],
};
