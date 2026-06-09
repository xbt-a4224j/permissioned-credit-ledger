// #14 fast-check property: eventId is deterministic + injective.
// The indexer (#16) dedupes on EventId and replay (#19) orders by it, so a collision or
// non-determinism here would silently double-count or reorder — the worst failure mode.
import { test } from "vitest";
import fc from "fast-check";
import { eventId } from "../src/brand.ts";

// arbitrary 32-byte tx hash + a non-negative log index.
const txHash = fc.hexaString({ minLength: 64, maxLength: 64 }).map((h) => `0x${h}` as const);
const logIndex = fc.integer({ min: 0, max: 1_000_000 });

test("eventId is deterministic and injective over (txHash, logIndex)", () => {
  fc.assert(
    fc.property(txHash, logIndex, txHash, logIndex, (h1, i1, h2, i2) => {
      // deterministic: same inputs -> same id, every time.
      if (eventId(h1, i1) !== eventId(h1, i1)) return false;
      // injective: distinct (hash, index) pairs -> distinct ids.
      const sameInput = h1.toLowerCase() === h2.toLowerCase() && i1 === i2;
      const sameId = eventId(h1, i1) === eventId(h2, i2);
      return sameInput === sameId;
    }),
    { numRuns: 256 },
  );
});
