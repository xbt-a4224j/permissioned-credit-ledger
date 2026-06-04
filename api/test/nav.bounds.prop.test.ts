// Money Layer · #17 fast-check property: the bounds gate never admits an out-of-bounds mark.
// For any sequence of NAV marks, folding them through withinBounds (advancing the baseline only
// on ACCEPT) yields: every accepted mark is strictly timestamp-monotonic AND within maxJumpBps
// of its accepted predecessor; every mark violating either is rejected. No false negatives — an
// out-of-bounds mark can never slip into the accepted feed. Also asserts purity/determinism
// (same args -> same verdict), which #19's replay relies on.
import { expect, test } from "vitest";
import fc from "fast-check";
import { bps, unixSeconds, loanId, type NavReading } from "@pcl/shared";
import { withinBounds, NAV_BOUNDS } from "../src/nav/bounds.ts";

const LOAN = loanId(1);

// arbitrary NAV mark: bps in [0, 30000] (0%..300% of par) and a monotone-ish timestamp.
const markArb = fc.record({
  navBps: fc.integer({ min: 0, max: 30000 }),
  dt: fc.integer({ min: -50, max: 500 }), // delta seconds vs running clock (can go backwards)
});

test("withinBounds never admits an out-of-bounds or non-monotonic mark", () => {
  fc.assert(
    fc.property(fc.array(markArb, { minLength: 1, maxLength: 30 }), (marks) => {
      let prev: NavReading | null = null;
      let clock = 1_700_000_000;
      // `now` is far in the future so staleness never trips here (this property targets the
      // jump + monotonic guards; staleness has its own unit test).
      const now = unixSeconds(clock + 10_000_000);

      for (const m of marks) {
        clock += m.dt;
        const observedAt = unixSeconds(Math.max(0, clock));
        const next: NavReading = { loan: LOAN, navBps: bps(m.navBps), observedAt, source: "p" };

        const verdict = withinBounds(prev, next, now);
        // determinism: identical inputs -> identical verdict.
        expect(withinBounds(prev, next, now)).toEqual(verdict);

        if (verdict.ok) {
          // an accepted mark MUST satisfy both invariants relative to the accepted baseline.
          if (prev !== null) {
            if (next.observedAt <= prev.observedAt) return false; // monotonic violated but accepted
            if (Math.abs(next.navBps - prev.navBps) > NAV_BOUNDS.maxJumpBps) return false; // jump violated but accepted
          }
          prev = next; // baseline advances ONLY on accept
        } else {
          // a rejected mark must genuinely violate something (UnknownLoan excluded — known=true here).
          const stale = now - next.observedAt > NAV_BOUNDS.maxStalenessSec;
          const nonMono = prev !== null && next.observedAt <= prev.observedAt;
          const outOfBounds = prev !== null && Math.abs(next.navBps - prev.navBps) > NAV_BOUNDS.maxJumpBps;
          if (!stale && !nonMono && !outOfBounds) return false; // rejected with no actual violation
        }
      }
      return true;
    }),
    { numRuns: 256 },
  );
});
