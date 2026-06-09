// #23 tx-status tracking — PENDING -> CONFIRMED|REVERTED + optimistic write.
// recordPending stamps a PENDING row (+ an optimistic position for an invest); the confirmation
// watcher transitions it on a mocked receipt: success -> CONFIRMED with the block; reverted ->
// REVERTED with a decoded ReasonCode (not a raw string). Every transition emits exactly one `tx`
// SSE event. Uses a real seeded db + a mocked waitForTransactionReceipt (no chain).
import { afterAll, beforeAll, expect, test } from "vitest";
import { encodeErrorResult, ContractFunctionRevertedError, type Hex } from "viem";
import type { Sql } from "@pcl/shared";
import { seededDb } from "./helpers.ts";
import { EventBus, type FeedEnvelope } from "../src/sse/bus.ts";
import { recordPending, settlePending } from "../src/tx/tracker.ts";
import { COMBINED_ERROR_ABI } from "../src/chain/abi.ts";

let sql: Sql;
let dispose: () => Promise<void>;

const HOLDER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as const;
const HASH_OK = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
const HASH_BAD = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;

beforeAll(async () => {
  const db = await seededDb("pcl_tx");
  sql = db.sql;
  dispose = db.dispose;
});
afterAll(async () => {
  await dispose();
});

// a mock receipt client: returns a programmed status for a given hash.
function mockReceiptClient(byHash: Record<string, { status: "success" | "reverted"; blockNumber: bigint }>) {
  return {
    waitForTransactionReceipt: ({ hash }: { hash: Hex }) => {
      const r = byHash[hash];
      if (r === undefined) throw new Error(`no mock receipt for ${hash}`);
      return Promise.resolve(r);
    },
  };
}

test("recordPending inserts 1 PENDING tx + 1 optimistic position for an invest", async () => {
  await recordPending(sql, { hash: HASH_OK, kind: "invest", holder: HOLDER, loanId: "1", amount: 5_000_000n });
  const tx = await sql<{ count: bigint }[]>`select count(*)::bigint as count from tx_status where hash = ${HASH_OK} and state = 'PENDING'`;
  expect(tx[0]?.count).toBe(1n);
  const opt = await sql<{ count: bigint }[]>`select count(*)::bigint as count from optimistic_positions where hash = ${HASH_OK}`;
  expect(opt[0]?.count).toBe(1n);
});

test("a success receipt -> CONFIRMED with block + exactly one tx SSE event", async () => {
  const bus = new EventBus();
  const seen: FeedEnvelope[] = [];
  bus.on((e) => seen.push(e));
  const client = mockReceiptClient({ [HASH_OK]: { status: "success", blockNumber: 42n } });

  await settlePending(sql, client, bus, HASH_OK);

  const row = await sql<{ state: string; block_number: bigint | null }[]>`select state, block_number::text as block_number from tx_status where hash = ${HASH_OK}`;
  expect(row[0]?.state).toBe("CONFIRMED");
  expect(row[0]?.block_number).not.toBeNull();
  const txEvents = seen.filter((e) => e.event.type === "tx");
  expect(txEvents.length).toBe(1);
  expect(txEvents[0]?.event.type === "tx" && txEvents[0].event.data.state).toBe("CONFIRMED");
});

test("a reverted receipt (InsufficientReserve) -> REVERTED with the decoded ReasonCode", async () => {
  // record a PENDING claim, then settle with a revert whose error data decodes to InsufficientReserve.
  await recordPending(sql, { hash: HASH_BAD, kind: "claim", holder: HOLDER, loanId: "1" });

  const data = encodeErrorResult({ abi: COMBINED_ERROR_ABI, errorName: "InsufficientReserve", args: [1000n, 1n] });
  // a client whose waitForTransactionReceipt throws a viem revert carrying that data.
  const client = {
    waitForTransactionReceipt: () => {
      throw new ContractFunctionRevertedError({
        abi: COMBINED_ERROR_ABI,
        data,
        functionName: "claim",
      });
    },
  };
  const bus = new EventBus();
  const seen: FeedEnvelope[] = [];
  bus.on((e) => seen.push(e));

  await settlePending(sql, client, bus, HASH_BAD);

  const row = await sql<{ state: string; reason_code: string | null }[]>`select state, reason_code from tx_status where hash = ${HASH_BAD}`;
  expect(row[0]?.state).toBe("REVERTED");
  expect(row[0]?.reason_code).toBe("InsufficientReserve");
  const txEvents = seen.filter((e) => e.event.type === "tx");
  expect(txEvents.length).toBe(1);
  expect(txEvents[0]?.event.type === "tx" && txEvents[0].event.data.reasonCode).toBe("InsufficientReserve");
});

test("settling is idempotent on state — a settled row is not re-transitioned", async () => {
  const bus = new EventBus();
  const client = mockReceiptClient({ [HASH_OK]: { status: "success", blockNumber: 99n } });
  // HASH_OK is already CONFIRMED; settling again leaves it CONFIRMED at the original block (42).
  await settlePending(sql, client, bus, HASH_OK);
  const row = await sql<{ state: string; block_number: string }[]>`select state, block_number::text as block_number from tx_status where hash = ${HASH_OK}`;
  expect(row[0]?.state).toBe("CONFIRMED");
  expect(row[0]?.block_number).toBe("42"); // unchanged (the WHERE state='PENDING' guard).
});
