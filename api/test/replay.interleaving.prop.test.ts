// The Seam · #19 THE headline property: replay is interleaving-invariant.
// For an arbitrary input set and any permutation of it, stateHash(replay(permA)) ===
// stateHash(replay(permB)). The canonical (blockNumber, logIndex) / (observedAt, source) order
// collapses every arrival interleaving to one fold order -> one stateHash. This is the formal
// backbone of the thesis: the book is reproducible from its inputs, byte-for-byte. Pure (no DB,
// no chain, no clock) so it runs at >=256 runs fast and can't flake on a V8/engine difference.
import { test } from "vitest";
import fc from "fast-check";
import { bps, eventId, identityAddr, loanId, unixSeconds, usdc6, type ChainEvent, type NavReading } from "@pcl/shared";
import { replay } from "../src/replay/replay.ts";
import { stateHash } from "../src/replay/hash.ts";
import type { ReplayInput } from "../src/replay/types.ts";

const TOKEN = identityAddr("0x8a791620dd6260079bf849dc5567adc3f2fdc318");
const ZERO = identityAddr("0x0000000000000000000000000000000000000000");
const LOAN = loanId(1);

function holder(i: number): `0x${string}` {
  return ("0x" + (i + 1).toString(16).padStart(40, "0")) as `0x${string}`;
}
function txh(n: number): `0x${string}` {
  return ("0x" + (n + 1).toString(16).padStart(64, "0")) as `0x${string}`;
}

// a mint = Transfer(0x0 -> holder) + PositionOpened, additive across distinct holders so any
// balance ordering converges (the property targets ORDER-INDEPENDENCE of the fold, not signed
// transfer hazards). NAV marks are added monotonically so a deterministic subset is accepted.
function buildPool(numMints: number, navCount: number): ReplayInput[] {
  const inputs: ReplayInput[] = [];
  for (let i = 0; i < numMints; i++) {
    const block = BigInt(i + 1);
    const h = identityAddr(holder(i));
    const amount = usdc6(BigInt((i + 1) * 1000));
    const t: Extract<ChainEvent, { name: "Transfer" }> = { id: eventId(txh(i), 0), name: "Transfer", blockNumber: block, logIndex: 0, token: TOKEN, loan: LOAN, from: ZERO, to: h, amount };
    const po: Extract<ChainEvent, { name: "PositionOpened" }> = { id: eventId(txh(i), 1), name: "PositionOpened", blockNumber: block, logIndex: 1, token: TOKEN, holder: h, loan: LOAN, amount };
    inputs.push({ kind: "chain", event: t }, { kind: "chain", event: po });
  }
  for (let j = 0; j < navCount; j++) {
    const reading: NavReading = { loan: LOAN, navBps: bps(10000 + j * 100), observedAt: unixSeconds(1_700_000_000 + j), source: `s${j}` };
    inputs.push({ kind: "nav", reading });
  }
  return inputs;
}

// permute `arr` by the Fisher-Yates sequence encoded in `swaps` (deterministic, total).
function permute<T>(arr: T[], swaps: number[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (swaps[i] ?? 0) % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

test("any permutation of the same input set yields an identical stateHash", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 0, max: 5 }),
      fc.array(fc.nat(), { minLength: 0, maxLength: 30 }),
      fc.array(fc.nat(), { minLength: 0, maxLength: 30 }),
      (numMints, navCount, swapsA, swapsB) => {
        const pool = buildPool(numMints, navCount);
        // two independent permutations of the SAME multiset of inputs.
        const permA = permute(pool, swapsA);
        const permB = permute(pool, swapsB);
        return stateHash(replay(permA)) === stateHash(replay(permB));
      },
    ),
    { numRuns: 256 },
  );
});

test("applyInput is referentially transparent: replaying the same list twice -> identical hash", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 5 }), (numMints, navCount) => {
      const pool = buildPool(numMints, navCount);
      return stateHash(replay(pool)) === stateHash(replay(pool));
    }),
    { numRuns: 256 },
  );
});
