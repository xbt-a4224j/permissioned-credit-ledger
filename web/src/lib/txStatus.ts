// Money Layer (presentation) · the tx lifecycle hook — signing -> pending -> confirmed|reverted · #25
// Drives a mutation through its phases and surfaces the typed outcome. `run(send)` calls the given
// mutation (which returns a typed MutationResult): on ok it goes signing -> pending and then polls
// txStatus(hash) (the #23 tracker) until the indexer settles it CONFIRMED/REVERTED; on a typed
// revert it lands `reverted` with the ReasonCode and rolls the optimistic position back (row-8: an
// InsufficientReserve claim must NOT reset accrued in the UI). Money stays bigint end to end.
import { useCallback, useRef, useState } from "react";
import type { ReasonCode } from "./reasonCodes.ts";
import type { MutationResult, TxReceiptRef } from "./mutations.ts";
import { gql } from "./graphqlClient.ts";

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "reverted";

// #23 the txStatus(hash) query the watcher polls to settle a PENDING ref.
const TX_STATUS_QUERY = /* GraphQL */ `
  query TxStatus($hash: String!) {
    txStatus(hash: $hash) { hash state reasonCode blockNumber }
  }
`;

export interface TxLifecycle {
  phase: TxPhase;
  txHash?: `0x${string}`;
  reason?: ReasonCode;
  optimistic: boolean; // true while a pre-confirmation position should show; false once rolled back/settled
  run(send: () => Promise<MutationResult<TxReceiptRef>>): Promise<void>;
  reset(): void;
}

// #25 poll txStatus until it settles or the cap is hit. Injectable poller/limits keep the test fast.
async function pollSettlement(
  hash: string,
  poll: (h: string) => Promise<{ state: TxReceiptRef["state"]; reasonCode: ReasonCode | null }>,
  attempts: number,
  delayMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<{ state: TxReceiptRef["state"]; reasonCode: ReasonCode | null }> {
  for (let i = 0; i < attempts; i++) {
    const s = await poll(hash);
    if (s.state !== "PENDING") return s;
    await sleep(delayMs);
  }
  return { state: "PENDING", reasonCode: null };
}

// #25 default poller hits the API; tests inject their own via the optional `opts.poll`.
async function defaultPoll(hash: string): Promise<{ state: TxReceiptRef["state"]; reasonCode: ReasonCode | null }> {
  const data = await gql<{ txStatus: TxReceiptRef | null }, { hash: string }>(TX_STATUS_QUERY, { hash });
  const ref = data.txStatus;
  return { state: ref?.state ?? "PENDING", reasonCode: ref?.reasonCode ?? null };
}

export interface TxLifecycleOpts {
  poll?: (hash: string) => Promise<{ state: TxReceiptRef["state"]; reasonCode: ReasonCode | null }>;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export function useTxLifecycle(opts: TxLifecycleOpts = {}): TxLifecycle {
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [reason, setReason] = useState<ReasonCode | undefined>(undefined);
  const [optimistic, setOptimistic] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(undefined);
    setReason(undefined);
    setOptimistic(false);
  }, []);

  const run = useCallback(async (send: () => Promise<MutationResult<TxReceiptRef>>): Promise<void> => {
    setReason(undefined);
    setPhase("signing");
    setOptimistic(true); // show the optimistic position the instant we sign
    let result: MutationResult<TxReceiptRef>;
    try {
      result = await send();
    } catch {
      setOptimistic(false);
      setPhase("reverted");
      return;
    }

    // a typed revert/HALT surfaced at the GraphQL boundary (extensions.code).
    if (!result.ok) {
      setOptimistic(false); // row-8: roll the optimistic position back; accrued stays intact
      setReason(result.code);
      setPhase("reverted");
      return;
    }

    // clean broadcast: record the hash. If the resolver already returned a terminal state
    // (a same-tx confirmation, e.g. local node), settle immediately without polling.
    setTxHash(result.txHash);
    if (result.data.state === "CONFIRMED") {
      setOptimistic(false);
      setPhase("confirmed");
      return;
    }
    if (result.data.state === "REVERTED") {
      setOptimistic(false);
      if (result.data.reasonCode !== null) setReason(result.data.reasonCode);
      setPhase("reverted");
      return;
    }
    setPhase("pending");
    const o = optsRef.current;
    const settled = await pollSettlement(
      result.txHash,
      o.poll ?? defaultPoll,
      o.attempts ?? 30,
      o.delayMs ?? 1000,
      o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    );
    if (settled.state === "REVERTED") {
      setOptimistic(false);
      if (settled.reasonCode !== null) setReason(settled.reasonCode);
      setPhase("reverted");
    } else if (settled.state === "CONFIRMED") {
      setOptimistic(false); // canonical row has landed; optimistic no longer needed
      setPhase("confirmed");
    }
    // still PENDING after the cap: leave it pending (the SSE/poll will catch up later).
  }, []);

  const api: TxLifecycle = { phase, optimistic, run, reset };
  if (txHash !== undefined) api.txHash = txHash;
  if (reason !== undefined) api.reason = reason;
  return api;
}
