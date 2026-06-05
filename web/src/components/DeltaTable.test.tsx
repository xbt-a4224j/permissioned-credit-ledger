// #26 DeltaTable property suite — the UI never recomputes a delta the engine didn't deliver.
// For an arbitrary array of BalanceDelta: (a) every row renders deltaWei == onChainClaimableWei -
// offChainCollectedWei (the engine's delta, displayed as fmtUsd6), and (b) every row whose deltaWei
// !== 0n carries the flagged class (data-flagged="true") while zero-delta rows do not. >=100 cases.
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import fc from "fast-check";
import type { Address } from "viem";
import { DeltaTable } from "./DeltaTable.tsx";
import type { BalanceDelta } from "../lib/reconStream.ts";
import { fmtUsd6 } from "../lib/format.ts";

afterEach(cleanup);

// #26 a generator of well-formed BalanceDeltas: deltaWei is ALWAYS onchain - offchain (the engine's
// invariant; the UI must render it as delivered, never recompute differently).
const deltaArb = fc.array(
  fc.record({
    holderSeed: fc.hexaString({ minLength: 40, maxLength: 40 }),
    onChainClaimableWei: fc.bigInt({ min: 0n, max: 10n ** 18n }),
    offChainCollectedWei: fc.bigInt({ min: 0n, max: 10n ** 18n }),
  }),
  { minLength: 1, maxLength: 6 },
);

function build(rows: { holderSeed: string; onChainClaimableWei: bigint; offChainCollectedWei: bigint }[]): BalanceDelta[] {
  // dedupe holders so each row has a unique data-testid key.
  return rows.map((r, i) => {
    const holder = `0x${i.toString(16).padStart(2, "0")}${r.holderSeed.slice(2)}`.slice(0, 42) as Address;
    return {
      holder,
      onChainClaimableWei: r.onChainClaimableWei,
      offChainCollectedWei: r.offChainCollectedWei,
      deltaWei: r.onChainClaimableWei - r.offChainCollectedWei,
    };
  });
}

describe("DeltaTable", () => {
  it("renders the engine's deltaWei and flags exactly the non-zero rows (>=100 cases)", () => {
    fc.assert(
      fc.property(deltaArb, (raw) => {
        const deltas = build(raw);
        const { container, unmount } = render(<DeltaTable deltas={deltas} />);
        for (const d of deltas) {
          const row = within(container).getByTestId(`delta-${d.holder}`);
          // (a) the displayed delta equals onchain - offchain, as delivered.
          expect(row).toHaveTextContent(fmtUsd6(d.onChainClaimableWei - d.offChainCollectedWei));
          // (b) flagged iff deltaWei !== 0n.
          expect(row.getAttribute("data-flagged")).toBe(d.deltaWei !== 0n ? "true" : "false");
        }
        unmount();
      }),
      { numRuns: 120 },
    );
  });

  it("shows the empty state when there are no deltas", () => {
    const { getByText } = render(<DeltaTable deltas={[]} />);
    expect(getByText(/on-chain and off-chain agree/i)).toBeInTheDocument();
  });
});
