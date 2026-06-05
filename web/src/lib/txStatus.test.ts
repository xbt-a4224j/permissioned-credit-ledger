// #25 useTxLifecycle — phase machine + optimistic rollback fidelity.
// Drives the hook through signing -> pending -> confirmed via an injected poller; a mutation that
// returns { ok:false, code:'InsufficientReserve' } lands phase 'reverted' with the reason set AND
// rolls the optimistic position back (row-8: accrued must NOT be reset, so `optimistic` flips false
// while the canonical accrued stays the engine's). No real timers — the poller/sleep are injected.
import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTxLifecycle } from "./txStatus.ts";
import type { MutationResult, TxReceiptRef } from "./mutations.ts";

const HASH = "0xabc" as const;

function okResult(): MutationResult<TxReceiptRef> {
  return { ok: true, data: { hash: HASH, state: "PENDING", reasonCode: null, blockNumber: null, position: null }, txHash: HASH };
}

describe("useTxLifecycle", () => {
  it("drives signing -> pending -> confirmed and clears optimistic on settle", async () => {
    const poll = async (): Promise<{ state: TxReceiptRef["state"]; reasonCode: null }> => ({ state: "CONFIRMED", reasonCode: null });
    const { result } = renderHook(() => useTxLifecycle({ poll, attempts: 3, delayMs: 0, sleep: async () => {} }));

    await act(async () => {
      await result.current.run(async () => okResult());
    });
    await waitFor(() => expect(result.current.phase).toBe("confirmed"));
    expect(result.current.txHash).toBe(HASH);
    expect(result.current.optimistic).toBe(false);
    expect(result.current.reason).toBeUndefined();
  });

  it("lands reverted with the typed reason and rolls the optimistic position back (row 8)", async () => {
    const { result } = renderHook(() => useTxLifecycle());
    await act(async () => {
      await result.current.run(async () => ({ ok: false, code: "InsufficientReserve", message: "InsufficientReserve" }));
    });
    expect(result.current.phase).toBe("reverted");
    expect(result.current.reason).toBe("InsufficientReserve");
    // the optimistic position is rolled back so the accrued value (engine-owned) is not overwritten.
    expect(result.current.optimistic).toBe(false);
  });

  it("settles to reverted when the tracker reports REVERTED with a reasonCode", async () => {
    const poll = async (): Promise<{ state: TxReceiptRef["state"]; reasonCode: "NotEligible" }> => ({ state: "REVERTED", reasonCode: "NotEligible" });
    const { result } = renderHook(() => useTxLifecycle({ poll, attempts: 2, delayMs: 0, sleep: async () => {} }));
    await act(async () => {
      await result.current.run(async () => okResult());
    });
    await waitFor(() => expect(result.current.phase).toBe("reverted"));
    expect(result.current.reason).toBe("NotEligible");
    expect(result.current.optimistic).toBe(false);
  });
});
