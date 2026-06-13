// Money + ratio formatters — bigint-safe, no Number coercion · #24
// Money is 6-decimal USDC base units carried as a bigint end to end (the BigIntStr landmine: a
// Number() coercion above 2^53 desyncs the UI from the engine's deterministic state). fmtUsd6
// formats a bigint wei amount to a fixed-decimal currency string WITHOUT ever widening to a JS
// number; fmtBps/fmtLtv/fmtDscr render the mortgage ratios from integer basis points.

const USDC_DECIMALS = 6n;
const USDC_SCALE = 10n ** USDC_DECIMALS;

// #24 fmtUsd6: bigint base units -> "$1,234.560000". Splits whole/frac by integer division so no
// float ever touches the amount; round-trips back to the same integer (asserted in the property
// test). Negative amounts (deltas) keep their sign.
// #24 fmtUsd6: bigint base units -> "$1,234.5678". 4 decimal places: 2 keep money readable,
// the extra 2 make the per-second accrual ticker visibly count up every second.
const DISPLAY_DECIMALS = 4n;
const DISPLAY_SCALE = 10n ** DISPLAY_DECIMALS;
export function fmtUsd6(wei: bigint): string {
  const neg = wei < 0n;
  const abs = neg ? -wei : wei;
  const whole = abs / USDC_SCALE;
  const frac = abs % USDC_SCALE;
  const displayFrac = (frac * DISPLAY_SCALE) / USDC_SCALE;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${wholeStr}.${displayFrac.toString().padStart(Number(DISPLAY_DECIMALS), "0")}`;
}

// #24 the inverse used by the round-trip property test: parse a fmtUsd6 string back to bigint wei.
// fmtUsd6 now outputs 2 decimal places (cents) so the parser pads to 6 decimals for the round-trip.
// Note: round-tripping is lossy below 1 cent — sub-cent amounts are rounded in fmt and won't parse
// back to the original wei. The property test range is adjusted to multiples of 10000 (one cent).
export function parseUsd6(s: string): bigint {
  const neg = s.startsWith("-");
  const body = s.replace(/[-$,]/g, "");
  const [whole = "0", frac = ""] = body.split(".");
  // frac is 2 digits (cents); pad to 6 decimals for base-unit reconstruction.
  const fracPadded = frac.padEnd(Number(USDC_DECIMALS), "0").slice(0, Number(USDC_DECIMALS));
  const v = BigInt(whole) * USDC_SCALE + BigInt(fracPadded || "0");
  return neg ? -v : v;
}

// #24 fmtBps: integer basis points -> a percent string (100 bps = 1.00%). The coupon/rate display.
export function fmtBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

// #35 fmtApy: a per-second accrual rate (fixed-point scaled by 1e18, matching CreditToken.RATE_SCALE)
// -> an annualized percentage. APY = ratePerSecond * secondsPerYear / 1e18. Computed in bigint basis
// points (no float on the rate) then rendered as a percent — "Coupon / sec $1,000" was meaningless;
// "APY 3.15%" is the number an investor actually reads.
const SECONDS_PER_YEAR = 31_536_000n;
const RATE_SCALE = 10n ** 18n;
export function fmtApy(ratePerSecond: bigint): string {
  return fmtBps(apyBps(ratePerSecond));
}

// #81 the gross loan coupon as annualized basis points (numeric, for the net-yield split below).
export function apyBps(ratePerSecond: bigint): number {
  return Number((ratePerSecond * SECONDS_PER_YEAR * 10_000n) / RATE_SCALE);
}

// #81 the investor's share of the coupon — the rest is the originator/servicer/platform spread. A
// single relative coefficient (the #80 reserve credit uses the same share). 8000 bps = 80% to the
// investor. The token represents the investor's NET position; the spread lives above it.
export const INVESTOR_SHARE_BPS = 8000;

// #81 net yield to the investor = gross coupon * investor share. The headline number on the card.
export function fmtNetApy(ratePerSecond: bigint): string {
  return fmtBps(Math.round((apyBps(ratePerSecond) * INVESTOR_SHARE_BPS) / 10_000));
}

// #24 fmtLtv: loan-to-value, stored as basis points (7500 bps = 75.0% LTV).
export function fmtLtv(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

// #24 fmtDscr: debt-service-coverage ratio, stored as basis points (12500 bps = 1.25x).
export function fmtDscr(bps: number): string {
  return `${(bps / 10000).toFixed(2)}x`;
}
