// #26 HealthView — OK renders 4 green invariants + no banner; a ReconMismatch HALT renders the
// banner + the flagged invariant + the flagged non-zero delta row (the UI mirror of matrix row 10).
// Drives the view through a mocked recon EventSource (the same stream the header pill reads). Also
// guards the invariant name set against drift (exactly the engine's 4 #18 names).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, act, cleanup, within } from "@testing-library/react";
import { HealthView } from "./HealthView.tsx";

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  private listeners = new Map<string, ((ev: MessageEvent) => void)[]>();
  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (ev: MessageEvent) => void): void {
    const a = this.listeners.get(type) ?? [];
    a.push(fn);
    this.listeners.set(type, a);
  }
  emit(type: string, data: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn({ data } as MessageEvent);
  }
  close(): void {}
}

function inv(navOk: boolean): unknown {
  return [
    { name: "supplyBacked", ok: true, onchain: null, offchain: null, delta: null },
    { name: "claimableCovered", ok: true, onchain: null, offchain: null, delta: null },
    { name: "navInBounds", ok: navOk, onchain: null, offchain: null, delta: null },
    { name: "identityValid", ok: true, onchain: null, offchain: null, delta: null },
  ];
}

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
});
afterEach(cleanup);

const NAMES = ["SupplyBacked", "ClaimableLeCollected", "NavInBounds", "IdentityValid"];

describe("HealthView", () => {
  it("OK status renders exactly 4 invariants (the engine names) and no HALT banner", () => {
    render(<HealthView />);
    const es = MockEventSource.instances[0]!;
    act(() => es.emit("recon", JSON.stringify({ state: "OK", cycle: 1, checkedAt: new Date().toISOString(), haltReason: null, stateHash: "0xabc", invariants: inv(true) })));

    for (const n of NAMES) expect(screen.getByTestId(`invariant-${n}`)).toBeInTheDocument();
    expect(screen.getAllByText("PASS")).toHaveLength(4);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a ReconMismatch HALT renders the banner + flagged invariant + flagged delta row (row 10)", () => {
    render(<HealthView />);
    const es = MockEventSource.instances[0]!;
    act(() =>
      es.emit(
        "recon",
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
      ),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/HALTED/);
    // the failing invariant row is flagged.
    expect(within(screen.getByTestId("invariant-SupplyBacked")).getByText("FAIL")).toBeInTheDocument();
    // the offending non-zero delta row is flagged.
    expect(screen.getByTestId("delta-0xaaa").getAttribute("data-flagged")).toBe("true");
  });
});
