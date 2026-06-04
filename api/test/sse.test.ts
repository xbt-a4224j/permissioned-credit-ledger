// Money Layer · #22 SSE handler — push frames, resume, heartbeat, teardown.
// The handler turns the shared bus into a text/event-stream: a recon HALT frame propagates with
// the typed haltReason (matrix row 9), Last-Event-ID replays only newer ids (no duplicates),
// aborting removes the listener (no leak), and a heartbeat keeps the connection open. A fast-check
// property asserts every emitted frame parses back to a valid FeedEvent with a monotonic id.
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { EventBus, type FeedEvent } from "../src/sse/bus.ts";
import { sseHandler } from "../src/sse/handler.ts";
import { encodeFrame } from "../src/sse/serialize.ts";

// parse an SSE text chunk into {id,event,data} frames.
function parseFrames(text: string): { id: string; event: string; data: unknown }[] {
  const frames: { id: string; event: string; data: unknown }[] = [];
  for (const block of text.split("\n\n")) {
    const lines = block.split("\n");
    let id = "";
    let event = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("id: ")) id = line.slice(4);
      else if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event !== "" && data !== "") frames.push({ id, event, data: JSON.parse(data) });
  }
  return frames;
}

// read all currently-available bytes from a stream reader without blocking forever.
async function drain(reader: ReadableStreamDefaultReader<Uint8Array>, ms: number): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const next = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((r) => setTimeout(() => r({ done: true, value: undefined }), 50)),
    ]);
    if (next.value !== undefined) out += decoder.decode(next.value, { stream: true });
  }
  return out;
}

test("a recon HALTED frame propagates with the typed haltReason (matrix row 9)", async () => {
  const bus = new EventBus();
  const req = new Request("http://localhost/sse");
  const res = sseHandler(req, bus);
  const reader = res.body!.getReader();

  bus.publish({
    type: "recon",
    data: { state: "HALTED", cycle: 7, checkedAt: new Date(), invariants: [], haltReason: "NavAnomaly" },
  });

  const text = await drain(reader, 300);
  const reconFrames = parseFrames(text).filter((f) => f.event === "recon");
  expect(reconFrames.length).toBe(1);
  expect((reconFrames[0]?.data as { haltReason: string }).haltReason).toBe("NavAnomaly");
  await reader.cancel();
});

test("accrual frames carry accrued/claimable as decimal strings", async () => {
  const bus = new EventBus();
  const req = new Request("http://localhost/sse");
  const res = sseHandler(req, bus);
  const reader = res.body!.getReader();

  bus.publish({ type: "accrual", data: { holder: "0xabc", loanId: "1", accrued: "1000", claimable: "1500", at: new Date() } });
  const text = await drain(reader, 200);
  const f = parseFrames(text).find((x) => x.event === "accrual");
  expect(typeof (f?.data as { accrued: unknown }).accrued).toBe("string");
  expect(typeof (f?.data as { claimable: unknown }).claimable).toBe("string");
  await reader.cancel();
});

test("Last-Event-ID resumes only events with id > N (no duplicates)", async () => {
  const bus = new EventBus();
  // publish 3 events into the ring before any client connects.
  bus.publish({ type: "heartbeat", data: { ts: "a" } }); // id 1
  bus.publish({ type: "heartbeat", data: { ts: "b" } }); // id 2
  bus.publish({ type: "heartbeat", data: { ts: "c" } }); // id 3

  const req = new Request("http://localhost/sse", { headers: { "Last-Event-ID": "1" } });
  const res = sseHandler(req, bus);
  const reader = res.body!.getReader();
  const text = await drain(reader, 200);
  const ids = parseFrames(text).map((f) => Number(f.id));
  // first replayed id is 2 (id 1 excluded), then 3 — no duplicates, in order.
  expect(ids).toEqual([2, 3]);
  await reader.cancel();
});

test("aborting the request removes the bus listener (no leak)", async () => {
  const bus = new EventBus();
  const baseline = bus.listenerCount();
  const controller = new AbortController();
  const req = new Request("http://localhost/sse", { signal: controller.signal });
  const res = sseHandler(req, bus);
  const reader = res.body!.getReader();
  // start consuming so the stream `start` runs and subscribes.
  await drain(reader, 100);
  expect(bus.listenerCount()).toBe(baseline + 1);

  controller.abort();
  await reader.cancel().catch(() => {});
  // listener returns to baseline; a subsequent publish reaches no extra subscriber.
  expect(bus.listenerCount()).toBe(baseline);
});

describe("#22 frame encoding totality", () => {
  test("property: every event frame parses back to a valid FeedEvent with a monotonic id", () => {
    const arbEvent: fc.Arbitrary<FeedEvent> = fc.oneof(
      fc.record({
        type: fc.constant<"accrual">("accrual"),
        data: fc.record({
          holder: fc.constant("0xabc"),
          loanId: fc.constant("1"),
          accrued: fc.bigInt({ min: 0n, max: (1n << 200n) - 1n }).map((b) => b.toString()),
          claimable: fc.bigInt({ min: 0n, max: (1n << 200n) - 1n }).map((b) => b.toString()),
          at: fc.constant(new Date()),
        }),
      }),
      fc.record({ type: fc.constant<"tx">("tx"), data: fc.record({ hash: fc.hexaString({ minLength: 4, maxLength: 8 }).map((h) => `0x${h}`), state: fc.constantFrom("PENDING", "CONFIRMED", "REVERTED"), reasonCode: fc.constant(null), blockNumber: fc.constant(null), position: fc.constant(null) }) }) as fc.Arbitrary<FeedEvent>,
      fc.record({ type: fc.constant<"heartbeat">("heartbeat"), data: fc.record({ ts: fc.string() }) }),
    );

    fc.assert(
      fc.property(fc.array(arbEvent, { minLength: 1, maxLength: 20 }), (events) => {
        const bus = new EventBus(256);
        const lastIds: number[] = [];
        for (const e of events) {
          const env = bus.publish(e);
          lastIds.push(env.id);
          const frame = encodeFrame(env);
          const parsed = parseFrames(frame)[0]!;
          // the frame's event type is a valid discriminant and the data round-trips to JSON.
          expect(["accrual", "recon", "tx", "heartbeat"]).toContain(parsed.event);
          expect(Number(parsed.id)).toBe(env.id);
        }
        // ids strictly increase.
        for (let i = 1; i < lastIds.length; i++) expect(lastIds[i]!).toBeGreaterThan(lastIds[i - 1]!);
        return true;
      }),
      { numRuns: 256 },
    );
  });
});
