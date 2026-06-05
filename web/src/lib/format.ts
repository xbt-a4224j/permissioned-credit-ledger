// Money Layer (presentation) · money + ratio formatters — bigint-safe, no Number coercion · #24
// Money is 6-decimal USDC base units carried as a bigint end to end (the BigIntStr landmine: a
// Number() coercion above 2^53 desyncs the UI from the engine's deterministic state). fmtUsd6
// formats a bigint wei amount to a fixed-decimal currency string WITHOUT ever widening to a JS
// number; fmtBps/fmtLtv/fmtDscr render the mortgage ratios from integer basis points.

const USDC_DECIMALS = 6n;
const USDC_SCALE = 10n ** USDC_DECIMALS;

// #24 fmtUsd6: bigint base units -> "$1,234.560000". Splits whole/frac by integer division so no
// float ever touches the amount; round-trips back to the same integer (asserted in the property
// test). Negative amounts (deltas) keep their sign.
export function fmtUsd6(wei: bigint): string {
  const neg = wei < 0n;
  const abs = neg ? -wei : wei;
  const whole = abs / USDC_SCALE;
  const frac = abs % USDC_SCALE;
  const fracStr = frac.toString().padStart(Number(USDC_DECIMALS), "0");
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${wholeStr}.${fracStr}`;
}

// #24 the inverse used by the round-trip property test: parse a fmtUsd6 string back to bigint wei.
export function parseUsd6(s: string): bigint {
  const neg = s.startsWith("-");
  const body = s.replace(/[-$,]/g, "");
  const [whole = "0", frac = ""] = body.split(".");
  const fracPadded = frac.padEnd(Number(USDC_DECIMALS), "0").slice(0, Number(USDC_DECIMALS));
  const v = BigInt(whole) * USDC_SCALE + BigInt(fracPadded || "0");
  return neg ? -v : v;
}

// #24 fmtBps: integer basis points -> a percent string (100 bps = 1.00%). The coupon/rate display.
export function fmtBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

// #24 fmtLtv: loan-to-value, stored as basis points (7500 bps = 75.0% LTV).
export function fmtLtv(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

// #24 fmtDscr: debt-service-coverage ratio, stored as basis points (12500 bps = 1.25x).
export function fmtDscr(bps: number): string {
  return `${(bps / 10000).toFixed(2)}x`;
}
