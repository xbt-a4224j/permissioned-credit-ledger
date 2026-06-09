// #26/#26 HealthView — OK renders 4 green invariants + no banner; a ReconMismatch HALT renders the
// banner + the flagged invariant + the flagged non-zero delta row (the UI mirror of matrix row 10).
// HealthView now takes the recon `status` as a prop (App's single shared stream, #26); the test
// builds that status via the real parseReconFrame so it matches exactly what App passes down. Also
// guards the invariant name set against drift (exactly the engine's 4 #18 names).
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { HealthView } from "./HealthView.tsx";
import { parseReconFrame } from "../lib/reconStream.ts";

function inv(navOk: boolean): unknown {
  return [
    { name: "supplyBacked", ok: true, onchain: null, offchain: null, delta: null },
    { name: "claimableCovered", ok: true, onchain: null, offchain: null, delta: null },
    { name: "navInBounds", ok: navOk, onchain: null, offchain: null, delta: null },
    { name: "identityValid", ok: true, onchain: null, offchain: null, delta: null },
  ];
}

afterEach(cleanup);

const NAMES = ["SupplyBacked", "ClaimableLeCollected", "NavInBounds", "IdentityValid"];

describe("HealthView", () => {
  it("OK status renders exactly 4 invariants (the engine names) and no HALT banner", () => {
    const status = parseReconFrame(
      JSON.stringify({ state: "OK", cycle: 1, checkedAt: new Date().toISOString(), haltReason: null, stateHash: "0xabc", invariants: inv(true) }),
    );
    render(<HealthView status={status ?? undefined} />);

    for (const n of NAMES) expect(screen.getByTestId(`invariant-${n}`)).toBeInTheDocument();
    expect(screen.getAllByText("PASS")).toHaveLength(4);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a ReconMismatch HALT renders the banner + flagged invariant + flagged delta row (row 10)", () => {
    const status = parseReconFrame(
      JSON.stringify({
        state: "HALTED",
        cycle: 2,
        checkedAt: new Date().toISOString(),
        haltReason: "ReconMismatch",
        stateHash: "0xdef",
        invariants: [
          { name: "supplyBacked", ok: false, onchain: null, offchain: null, delta: "2000000" },
          { name: "claimableCovered", ok: true, onchain: null, offchain: null, delta: null },
          { name: "navInBounds", ok: true, onchain: null, offchain: null, delta: null },
          { name: "identityValid", ok: true, onchain: null, offchain: null, delta: null },
        ],
        deltas: [{ holder: "0xAAA", onChainClaimableWei: "5000000", offChainCollectedWei: "3000000", deltaWei: "2000000" }],
      }),
    );
    render(<HealthView status={status ?? undefined} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/HALTED/);
    // the failing invariant row is flagged.
    expect(within(screen.getByTestId("invariant-SupplyBacked")).getByText("FAIL")).toBeInTheDocument();
    // the offending non-zero delta row is flagged.
    expect(screen.getByTestId("delta-0xaaa").getAttribute("data-flagged")).toBe("true");
  });
});
