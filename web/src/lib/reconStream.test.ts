// #26 useReconStream — OK -> HALTED transitions, typed haltCode, invariant + delta mapping.
// Mock EventSource feeds `recon` frames: an OK frame, then a ReconMismatch frame (state flips to
// HALTED, haltCode === 'ReconMismatch', the offending non-zero BalanceDelta present); then a
// NavAnomaly frame (haltCode === 'NavAnomaly', NavInBounds invariant ok:false). The four invariant
// names are exactly the engine's (#18).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { parseReconFrame, useReconStream } from "./reconStream.ts";

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

// the wire invariants the engine pushes (camelCase names, #21 read model).
function invariants(navOk: boolean): unknown {
  return [
    { name: "supplyBacked", ok: true, onchain: null, offchain: null, delta: null },
    { name: "claimableCovered", ok: true, onchain: null, offchain: null, delta: null },
    { name: "navInBounds", ok: navOk, onchain: null, offchain: null, delta: null },
    { name: "identityValid", ok: true, onchain: null, offchain: null, delta: null },
  ];
}

function okFrame(): string {
  return JSON.stringify({ state: "OK", cycle: 1, checkedAt: new Date(1_700_000_000_000).toISOString(), haltReason: null, stateHash: "0xabc", invariants: invariants(true) });
}
function mismatchFrame(): string {
  return JSON.stringify({
    state: "HALTED",
    cycle: 2,
    checkedAt: new Date(1_700_000_001_000).toISOString(),
    haltReason: "ReconMismatch",
    stateHash: "0xdef",
    invariants: invariants(true),
    deltas: [
      { holder: "0xAAA", onChainClaimableWei: "5000000", offChainCollectedWei: "3000000", deltaWei: "2000000" },
      { holder: "0xBBB", onChainClaimableWei: "1000000", offChainCollectedWei: "1000000", deltaWei: "0" },
    ],
  });
}
function navFrame(): string {
  return JSON.stringify({ state: "HALTED", cycle: 3, checkedAt: new Date(1_700_000_002_000).toISOString(), haltReason: "NavAnomaly", stateHash: "0x999", invariants: invariants(false) });
}

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
});
afterEach(() => {
  MockEventSource.instances = [];
});

describe("parseReconFrame", () => {
  it("maps the 4 engine invariants to the canonical PascalCase names", () => {
    const s = parseReconFrame(okFrame());
    expect(s?.invariants.map((i) => i.name)).toEqual(["SupplyBacked", "ClaimableLeCollected", "NavInBounds", "IdentityValid"]);
  });
  it("drops a malformed frame without throwing", () => {
    expect(parseReconFrame("{bad")).toBeNull();
    expect(parseReconFrame(JSON.stringify({ state: "WAT" }))).toBeNull();
  });
});

describe("useReconStream", () => {
  it("flips OK -> HALTED on a ReconMismatch frame and surfaces the offending delta (row 10)", () => {
    const { result } = renderHook(() => useReconStream());
    const es = MockEventSource.instances[0]!;

    act(() => es.emit("recon", okFrame()));
    expect(result.current?.state).toBe("OK");
    expect(result.current?.haltCode).toBeUndefined();

    act(() => es.emit("recon", mismatchFrame()));
    expect(result.current?.state).toBe("HALTED");
    expect(result.current?.haltCode).toBe("ReconMismatch");
    const offending = result.current?.deltas.find((d) => d.deltaWei !== 0n);
    expect(offending?.deltaWei).toBe(2000000n);
  });

  it("raises NavAnomaly with the NavInBounds invariant failing (row 9)", () => {
    const { result } = renderHook(() => useReconStream());
    const es = MockEventSource.instances[0]!;
    act(() => es.emit("recon", navFrame()));
    expect(result.current?.haltCode).toBe("NavAnomaly");
    const nav = result.current?.invariants.find((i) => i.name === "NavInBounds");
    expect(nav?.ok).toBe(false);
  });
});
