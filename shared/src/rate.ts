// bps coupon -> on-chain ratePerSecond · #66
// The single source of truth for turning a loan's annual coupon (basis points) into the per-second,
// RATE_SCALE-fixed-point rate the CreditToken accrues at. Used at tokenize time (the on-chain deploy)
// AND by the marketplace loan resolver, so a runtime-tokenized loan's yield reads from loans.rate_bps
// instead of the static genesis manifest (which only knows the 6 seeded loans).

// #9 matches CreditToken.RATE_SCALE (1e18 fixed point) and a 365-day year.
export const RATE_SCALE = 10n ** 18n;
export const SECONDS_PER_YEAR = 31_536_000n;

export function ratePerSecondFromBps(rateBps: number | bigint): bigint {
  return (BigInt(rateBps) * RATE_SCALE) / (10_000n * SECONDS_PER_YEAR);
}
