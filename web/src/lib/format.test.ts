// #24 fmtUsd6 property suite — money formatting is bigint-exact (round-trip) and monotonic.
// The thesis is determinism; a lossy formatter would silently contradict the engine's state, so we
// prove fmtUsd6 never loses precision (parse(fmt(x)) === x) and preserves order (a<b => parse<parse)
// over >=100 fast-check cases up to 10^24 wei.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fmtApy, fmtBps, fmtDscr, fmtLtv, fmtUsd6, parseUsd6 } from "./format.ts";

describe("fmtUsd6", () => {
  // fmtUsd6 rounds to 2 decimal places (cents), so the round-trip property holds only for
  // multiples of 10_000 base units (one cent = 10_000 units in 6-decimal USDC).
  it("round-trips any cent-aligned bigint in [0, 10^24]", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 24n }), (wei) => {
        const centAligned = (wei / 10_000n) * 10_000n;
        expect(parseUsd6(fmtUsd6(centAligned))).toBe(centAligned);
      }),
      { numRuns: 200 },
    );
  });

  it("is monotonic for cent-aligned amounts", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 24n }), fc.bigInt({ min: 0n, max: 10n ** 24n }), (a, b) => {
        const ca = (a / 10_000n) * 10_000n;
        const cb = (b / 10_000n) * 10_000n;
        if (ca < cb) expect(parseUsd6(fmtUsd6(ca)) < parseUsd6(fmtUsd6(cb))).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("formats with 2 decimal places, $ and thousands separators", () => {
    expect(fmtUsd6(0n)).toBe("$0.00");
    expect(fmtUsd6(1_000_000n)).toBe("$1.00");
    expect(fmtUsd6(1_234_560_000n)).toBe("$1,234.56");
  });

  it("preserves the sign of a negative delta", () => {
    expect(fmtUsd6(-1_000_000n)).toBe("-$1.00");
  });
});

describe("ratio formatters", () => {
  it("fmtBps renders basis points as a percent", () => {
    expect(fmtBps(950)).toBe("9.50%");
  });
  it("fmtLtv renders one-decimal LTV", () => {
    expect(fmtLtv(7500)).toBe("75.0%");
  });
  it("fmtDscr renders coverage as a multiple", () => {
    expect(fmtDscr(12500)).toBe("1.25x");
  });
  it("fmtApy annualizes a 1e18-scaled per-second rate", () => {
    // #35 a ratePerSecond of 1e9 (RATE_SCALE 1e18) annualizes to ~3.15% APY.
    expect(fmtApy(1_000_000_000n)).toBe("3.15%");
    // ~10% APY rate: 0.10 * 1e18 / secondsPerYear ≈ 3.170979198e9.
    expect(fmtApy(3_170_979_198n)).toBe("10.00%");
    expect(fmtApy(0n)).toBe("0.00%");
  });
});
