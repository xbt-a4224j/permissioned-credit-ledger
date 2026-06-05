// The Seam · #19 stateHash is serialization-stable; replay reproduces both HALT outcomes.
import { describe, expect, test } from "vitest";
import { bps, eventId, identityAddr, loanId, unixSeconds, usdc6, type ChainEvent, type NavReading } from "@pcl/shared";
import { replay } from "../src/replay/replay.ts";
import { canonicalize, stateHash } from "../src/replay/hash.ts";
import { emptyState } from "../src/replay/state.ts";
import { applyInput } from "../src/replay/fold.ts";
import type { ReplayInput } from "../src/replay/types.ts";

const TOKEN = identityAddr("0x8a791620dd6260079bf849dc5567adc3f2fdc318");
const ZERO = identityAddr("0x0000000000000000000000000000000000000000");
const HOLDER = identityAddr("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
const LOAN = loanId(1);

function txh(n: number): `0x${string}` {
  return ("0x" + (n + 1).toString(16).padStart(64, "0")) as `0x${string}`;
}
function mint(amount: bigint): ReplayInput[] {
  const t: Extract<ChainEvent, { name: "Transfer" }> = { id: eventId(txh(0), 0), name: "Transfer", blockNumber: 1n, logIndex: 0, token: TOKEN, loan: LOAN, from: ZERO, to: HOLDER, amount: usdc6(amount) };
  const po: Extract<ChainEvent, { name: "PositionOpened" }> = { id: eventId(txh(0), 1), name: "PositionOpened", blockNumber: 1n, logIndex: 1, token: TOKEN, holder: HOLDER, loan: LOAN, amount: usdc6(amount) };
  return [{ kind: "chain", event: t }, { kind: "chain", event: po }];
}
function nav(navBps: number, observedAt: number, source = "s"): ReplayInput {
  const reading: NavReading = { loan: LOAN, navBps: bps(navBps), observedAt: unixSeconds(observedAt), source };
  return { kind: "nav", reading };
}

test("stateHash is serialization-stable across a canonicalize round-trip", () => {
  const state = replay(mint(100_000n));
  const h1 = stateHash(state);
  // canonicalize -> JSON string -> parse: the hash is over the canonical form, so a re-hash of
  // the same state is identical and the canonical JSON is itself stable.
  const json = JSON.stringify(canonicalize(state));
  const reparsed = JSON.parse(json);
  expect(JSON.stringify(reparsed)).toBe(json);
  expect(stateHash(state)).toBe(h1);
});

test("an InterestClaimed without a prior accrual is deterministic (accrued resets to 0)", () => {
  // claim is a no-op on accrued (already 0) but debits the reserve; pure + deterministic.
  const claimed: Extract<ChainEvent, { name: "InterestClaimed" }> = { id: eventId(txh(2), 0), name: "InterestClaimed", blockNumber: 3n, logIndex: 0, token: TOKEN, holder: HOLDER, loan: LOAN, amount: usdc6(0n) };
  const inputs = [...mint(100_000n), { kind: "chain" as const, event: claimed }];
  expect(stateHash(replay(inputs))).toBe(stateHash(replay([...inputs].reverse())));
});

describe("replay reproduces both HALT outcomes", () => {
  test("row 9: a +40% NAV spike reaches halted.state === 'NavAnomaly'", () => {
    const inputs: ReplayInput[] = [...mint(100_000n), nav(10000, 1_700_000_000), nav(14000, 1_700_000_100)];
    const state = replay(inputs);
    expect(state.halted).toEqual({ state: "NavAnomaly", failed: "NavInBounds" });
  });

  test("row 10: over-claiming (reserve driven negative) reaches halted.state === 'ReconMismatch'", () => {
    // mint, no reserve funding, then claim more than the (zero) reserve holds -> balance < 0,
    // the replay analog of claimable > collected.
    const overclaim: Extract<ChainEvent, { name: "InterestClaimed" }> = { id: eventId(txh(3), 0), name: "InterestClaimed", blockNumber: 4n, logIndex: 0, token: TOKEN, holder: HOLDER, loan: LOAN, amount: usdc6(5000n) };
    const state = replay([...mint(100_000n), { kind: "chain", event: overclaim }]);
    expect(state.halted).toEqual({ state: "ReconMismatch", failed: "ClaimableCovered" });
  });
});

test("emptyState hashes to a stable, non-empty fingerprint", () => {
  expect(stateHash(emptyState())).toMatch(/^0x[0-9a-f]{64}$/);
  // applyInput on empty with a nav mark is pure.
  const now = unixSeconds(1_700_000_100);
  const a = applyInput(emptyState(), nav(10000, 1_700_000_000), now);
  const b = applyInput(emptyState(), nav(10000, 1_700_000_000), now);
  expect(stateHash(a)).toBe(stateHash(b));
});
