// Money Layer · #22 SSE sources — the accrual ticker + recon push off the read models.
// startAccrualSource emits a per-holder `accrual` tick on a fixed interval (a display projection,
// never written back); startReconSource emits a `recon` frame on every new cycle. The verify-gate
// SSE smoke asserts >= 3 accrual frames arrive within 3.5s at a 1000ms tick through the real
// handler — the live feed works end to end without the client polling.
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Sql } from "@pcl/shared";
import type { Manifest } from "../../indexer/src/index.ts";
import { migratedDb, seedPosition } from "./helpers.ts";
import { EventBus, type FeedEnvelope } from "../src/sse/bus.ts";
import { startAccrualSource, startReconSource } from "../src/sse/sources.ts";
import { sseHandler } from "../src/sse/handler.ts";

let sql: Sql;
let manifest: Manifest;
let dispose: () => Promise<void>;

const HOLDER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as const;

beforeAll(async () => {
  const db = await migratedDb("pcl_sse");
  sql = db.sql;
  manifest = db.manifest;
  dispose = db.dispose;
  // a controlled open position on loan 1 so the accrual source has a holder to tick (block 0 ->
  // a large elapsed -> a non-zero claimable projection each tick).
  await seedPosition(sql, "1", HOLDER, 100_000_000_000n, 0);
});
afterAll(async () => {
  await dispose();
});

test("startAccrualSource emits accrual ticks off the seeded positions", async () => {
  const bus = new EventBus();
  const seen: FeedEnvelope[] = [];
  bus.on((e) => seen.push(e));
  // fast tick for a quick assertion; the anchor position (loan 1) is seeded.
  const stop = startAccrualSource({ db: sql, manifest }, bus, 100);
  await new Promise((r) => setTimeout(r, 350));
  stop();

  const accrual = seen.filter((e) => e.event.type === "accrual");
  expect(accrual.length).toBeGreaterThanOrEqual(2);
  const tick = accrual[0]!;
  expect(tick.event.type === "accrual" && typeof tick.event.data.claimable).toBe("string");
});

test("startReconSource emits a recon frame for the latest cycle", async () => {
  const bus = new EventBus();
  const seen: FeedEnvelope[] = [];
  bus.on((e) => seen.push(e));
  const stop = startReconSource({ db: sql }, bus, 100);
  // give the initial poll a moment, then commit a new recon cycle.
  await new Promise((r) => setTimeout(r, 150));
  await sql`insert into recon_status (ok, state, failed_invariant, state_hash, detail) values (true, null, null, '0xfeed', null)`;
  await new Promise((r) => setTimeout(r, 250));
  stop();

  const recon = seen.filter((e) => e.event.type === "recon");
  expect(recon.length).toBeGreaterThanOrEqual(1);
  expect(recon.at(-1)!.event.type === "recon" && recon.at(-1)!.event.data).toBeTruthy();
});

test("SSE smoke (verify gate): >= 3 accrual frames within 3.5s at a 1000ms tick", async () => {
  const bus = new EventBus();
  const stop = startAccrualSource({ db: sql, manifest }, bus, 1000);
  const req = new Request("http://localhost/sse");
  const res = sseHandler(req, bus);
  expect(res.headers.get("content-type")).toBe("text/event-stream");
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  // a single continuous read loop (never two concurrent reader.read() calls); a watchdog cancels
  // the reader after the 3.5s window so the loop terminates.
  let accrualCount = 0;
  const watchdog = setTimeout(() => void reader.cancel().catch(() => {}), 3500);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value !== undefined) {
        accrualCount += (decoder.decode(value, { stream: true }).match(/event: accrual/g) ?? []).length;
        if (accrualCount >= 3) break;
      }
    }
  } finally {
    clearTimeout(watchdog);
    stop();
    await reader.cancel().catch(() => {});
  }
  expect(accrualCount).toBeGreaterThanOrEqual(3);
}, 6000);
