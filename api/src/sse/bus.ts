// In-process typed event bus for the SSE feed · #22
// A HALT must reach the UI the instant the engine commits it, not one poll later — so the API
// pushes. The bus is a tiny typed EventEmitter wrapper: sources (#22) and the tx tracker (#23)
// publish a discriminated FeedEvent; each /sse connection subscribes. A monotonic id is stamped
// per event and the last N are kept in a ring buffer so a reconnecting client can resume via
// Last-Event-ID. Money in every payload is BigIntStr (string), never a widened number.
import { EventEmitter } from "node:events";
import type { ReconciliationStatusSource } from "../schema/types/reconciliation.ts";
import type { TxReceiptRefSource } from "../schema/types/tx.ts";

// #22 a per-holder accrual tick (a display projection — NOT a source of truth, never written back).
export interface AccrualTick {
  holder: string;
  loanId: string;
  accrued: string;
  claimable: string;
  at: Date;
}

// #22 the discriminated feed union (matrix rows 9-10 propagate as a `recon` HALT frame).
export type FeedEvent =
  | { type: "accrual"; data: AccrualTick }
  | { type: "recon"; data: ReconciliationStatusSource }
  | { type: "tx"; data: TxReceiptRefSource }
  | { type: "heartbeat"; data: { ts: string } };

// #22 an envelope: the bus stamps a monotonic id so the ring buffer + Last-Event-ID resume work.
export interface FeedEnvelope {
  id: number;
  event: FeedEvent;
}

// #22 default ring-buffer capacity (the last N events replayable on reconnect).
const DEFAULT_RING = 128;

// #22 the typed bus. publish() stamps the next id, retains it in the ring, and emits. on()/off()
// subscribe/unsubscribe a listener; replaySince() serves Last-Event-ID resume from the ring.
export class EventBus {
  private readonly emitter = new EventEmitter();
  private seq = 0;
  private readonly ring: FeedEnvelope[] = [];

  constructor(private readonly ringSize: number = DEFAULT_RING) {
    // many concurrent SSE connections subscribe; lift the default 10-listener cap.
    this.emitter.setMaxListeners(0);
  }

  // #22 publish an event: stamp a monotonic id, retain in the ring, fan out to subscribers.
  publish(event: FeedEvent): FeedEnvelope {
    const envelope: FeedEnvelope = { id: ++this.seq, event };
    this.ring.push(envelope);
    if (this.ring.length > this.ringSize) this.ring.shift();
    this.emitter.emit("event", envelope);
    return envelope;
  }

  // #22 subscribe; returns an unsubscribe fn (the handler calls it on req abort, #22).
  on(listener: (e: FeedEnvelope) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  // #22 current subscriber count (the abort test asserts this returns to baseline).
  listenerCount(): number {
    return this.emitter.listenerCount("event");
  }

  // #22 the last id stamped (resume anchor).
  lastId(): number {
    return this.seq;
  }

  // #22 replay buffered events with id > since (Last-Event-ID resume; no duplicates, in order).
  replaySince(since: number): FeedEnvelope[] {
    return this.ring.filter((e) => e.id > since);
  }
}
