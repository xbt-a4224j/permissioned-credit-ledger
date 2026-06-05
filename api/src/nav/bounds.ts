// Money Layer · NAV validation gate — the pure bounds predicate · #17
// NAV is the off-chain truth on-chain accrual is meant to track. This is the FIRST of the two
// HALT mechanisms (the recon engine, #18, is the second): a stale, out-of-bounds, or
// non-monotonic mark is refused — it never enters the accepted feed — and trips NavAnomaly,
// freezing accrual. withinBounds is PURE (no I/O, no clock of its own — `now` is injected) so
// the replay harness (#19) can re-derive NAV acceptance deterministically. The bound is the
// single shared constant; on-chain (the L2 freeze) and off-chain must agree or they reconcile
// to different claimable and you get a spurious halt (the NAV-bounds landmine).
import { bps, type Bps, type NavReading, type UnixSeconds } from "@pcl/shared";

// #17 the typed rejection reasons (no stringly-typed failures at call sites).
export type NavRejectReason = "Stale" | "OutOfBounds" | "NonMonotonicTimestamp" | "UnknownLoan";

// #17 the load-bearing bounds, env-overridable. maxJumpBps 2000 = +/-20%; the matrix row-9
// +40% (4000 bps) spike is therefore OutOfBounds. maxStalenessSec 3600 = a 1h freshness gate.
export const NAV_BOUNDS = {
  maxJumpBps: bps(envInt("NAV_MAX_JUMP_BPS", 2000)),
  maxStalenessSec: envInt("NAV_MAX_STALENESS_SEC", 3600) as UnixSeconds,
} as const;

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export type WithinBoundsResult = { ok: true } | { ok: false; state: "NavAnomaly"; reason: NavRejectReason };

// #17 absolute bps jump between two marks (a +40% jump and a -40% drop both trip the bound).
function jumpBps(prevBps: Bps, nextBps: Bps): number {
  return Math.abs(nextBps - prevBps);
}

// #17 the pure gate. `prev` is the last ACCEPTED reading for this loan (null on first mark);
// `known` flags whether the loan exists (UnknownLoan guard). Order of checks is fixed so the
// recorded reason is deterministic: UnknownLoan -> Stale -> NonMonotonicTimestamp -> OutOfBounds.
export function withinBounds(
  prev: NavReading | null,
  next: NavReading,
  now: UnixSeconds,
  known = true,
  bounds: { maxJumpBps: Bps; maxStalenessSec: UnixSeconds } = NAV_BOUNDS,
): WithinBoundsResult {
  if (!known) return { ok: false, state: "NavAnomaly", reason: "UnknownLoan" };

  // staleness: the mark must be observed within the freshness window of `now`.
  if (now - next.observedAt > bounds.maxStalenessSec) {
    return { ok: false, state: "NavAnomaly", reason: "Stale" };
  }

  if (prev !== null) {
    // monotonic timestamps: a mark must be strictly newer than the last accepted one, else
    // a replayed/duplicate mark could re-baseline the feed.
    if (next.observedAt <= prev.observedAt) {
      return { ok: false, state: "NavAnomaly", reason: "NonMonotonicTimestamp" };
    }
    // bounded jump vs the last ACCEPTED mark (not the last received — the cascade landmine).
    if (jumpBps(prev.navBps, next.navBps) > bounds.maxJumpBps) {
      return { ok: false, state: "NavAnomaly", reason: "OutOfBounds" };
    }
  }

  return { ok: true };
}
