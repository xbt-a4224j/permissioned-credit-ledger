// #24 useAccrualStream — accumulates per-position ticks, coalesces, and survives a bad frame.
// Uses a mock EventSource: synthetic `accrual` frames feed the hook; we assert ticks accumulate
// keyed by positionId, that a second frame for the same position coalesces (overwrites), and that a
// malformed frame is dropped without throwing. Money is asserted as bigint (no precision loss).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { parseAccrualFrame, useAccrualStream } from "./sse.ts";
import type { PositionId } from "../types.ts";

// #24 cast a literal key to the branded PositionId for the Map lookups under test.
const pid = (s: string): PositionId => s as PositionId;

// #24 a minimal EventSource stand-in driving named-event listeners.
class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  private listeners = new Map<string, ((ev: MessageEvent) => void)[]>();
  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (ev: MessageEvent) => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  emit(type: string, data: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn({ data } as MessageEvent);
  }
  close(): void {}
}

function frame(loanId: string, holder: string, accrued: string, claimable: string): string {
  return JSON.stringify({ loanId, holder, accrued, claimable, at: new Date(1_700_000_000_000).toISOString() });
}

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
});
afterEach(() => {
  MockEventSource.instances = [];
});

describe("parseAccrualFrame", () => {
  it("decodes money as bigint with no precision loss", () => {
    const tick = parseAccrualFrame(frame("1", "0xABC", "123456789012345678901234", "999999999999999999999999"));
    expect(tick?.accruedWei).toBe(123456789012345678901234n);
    expect(tick?.claimableWei).toBe(999999999999999999999999n);
    expect(tick?.positionId).toBe("1:0xabc");
  });
  it("drops a malformed frame without throwing", () => {
    expect(parseAccrualFrame("{ not json")).toBeNull();
    expect(parseAccrualFrame(JSON.stringify({ loanId: 1 }))).toBeNull();
  });
});

describe("useAccrualStream", () => {
  it("accumulates and coalesces ticks per position; ignores a bad frame", () => {
    const { result } = renderHook(() => useAccrualStream());
    const es = MockEventSource.instances[0]!;

    act(() => es.emit("accrual", frame("1", "0xAAA", "1000000", "1500000")));
    act(() => es.emit("accrual", frame("2", "0xBBB", "2000000", "2000000")));
    expect(result.current.size).toBe(2);
    expect(result.current.get(pid("1:0xaaa"))?.accruedWei).toBe(1000000n);

    // coalesce: a newer tick for the same position overwrites, size unchanged.
    act(() => es.emit("accrual", frame("1", "0xAAA", "1750000", "2250000")));
    expect(result.current.size).toBe(2);
    expect(result.current.get(pid("1:0xaaa"))?.accruedWei).toBe(1750000n);

    // a malformed frame is dropped, no throw, map unchanged.
    act(() => es.emit("accrual", "}{ broken"));
    expect(result.current.size).toBe(2);
  });
});
