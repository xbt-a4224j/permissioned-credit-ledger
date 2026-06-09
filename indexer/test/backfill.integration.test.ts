// #16 integration: backfill the seeded local chain into the read model.
// Against the local anvil node + Deploy.s.sol seed (#12), a matrix-row-1 accredited-US invest
// (the anchor position minted at deploy) projects EXACTLY 1 PositionOpened event row and 1
// positions row with accrued=0 and the correct principal. And because the indexer mirrors
// on-chain TRUTH (only emitted logs), no position exists for any address that never received
// tokens — a would-be reverted transfer leaves 0 rows. Requires the verify-gate stack
// (docker Postgres on 55432 + anvil on 18545 + a fresh deploy).
import { afterAll, beforeAll, expect, test } from "vitest";
import { identityAddr, type Sql } from "@pcl/shared";
import { makeChainClient } from "../src/client.ts";
import { backfill } from "../src/main.ts";
import { loadManifest, tokenAddresses, tokenToLoanMap } from "../src/manifest.ts";
import { seedReference } from "../src/seed.ts";
import { freshMigratedDb } from "../../shared/test/db.helper.ts";

const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";
// the anchor holder (ACCREDITED_US_1) + amount from Deploy.s.sol (ANCHOR_POSITION = 100_000e6).
const ACCREDITED_US_1 = identityAddr("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
const ANCHOR_PRINCIPAL = 100_000n * 1_000_000n; // 100,000 USDC at 6dp

let db: Awaited<ReturnType<typeof freshMigratedDb>>;
let sql: Sql;

beforeAll(async () => {
  db = await freshMigratedDb("pcl_backfill");
  sql = db.sql;
});

afterAll(async () => {
  await db.dispose();
});

test("backfilling the seeded local chain yields exactly the anchor position", async () => {
  const manifest = loadManifest(31337);
  await seedReference(sql, manifest);

  const client = makeChainClient(LOCAL_RPC, 31337);
  const latest = await client.getBlockNumber();
  const { applied } = await backfill(sql, client, tokenAddresses(manifest), tokenToLoanMap(manifest), 0n, latest);
  expect(applied).toBeGreaterThan(0);

  // exactly 1 PositionOpened event row (the anchor mint).
  const opened = await sql<{ count: bigint }[]>`select count(*)::bigint as count from chain_events where name = 'PositionOpened'`;
  expect(opened[0]?.count).toBe(1n);

  // exactly 1 position row: the anchor, accrued=0, correct principal.
  const positions = await sql<{ holder: string; principal: bigint; accrued: bigint; loan_id: string }[]>`
    select holder, principal, accrued, loan_id from positions where principal > 0
  `;
  expect(positions.length).toBe(1);
  expect(positions[0]?.holder).toBe(ACCREDITED_US_1);
  expect(positions[0]?.principal).toBe(ANCHOR_PRINCIPAL);
  expect(positions[0]?.accrued).toBe(0n);
  expect(positions[0]?.loan_id).toBe("1");
});

test("re-running backfill is a no-op (idempotent against the same chain)", async () => {
  const manifest = loadManifest(31337);
  const client = makeChainClient(LOCAL_RPC, 31337);
  const latest = await client.getBlockNumber();
  const { applied } = await backfill(sql, client, tokenAddresses(manifest), tokenToLoanMap(manifest), 0n, latest);
  // every event already ingested -> 0 newly applied.
  expect(applied).toBe(0);
  // still exactly one funded position.
  const positions = await sql<{ count: bigint }[]>`select count(*)::bigint as count from positions where principal > 0`;
  expect(positions[0]?.count).toBe(1n);
});
