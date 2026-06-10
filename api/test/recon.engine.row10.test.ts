// #18 matrix row 10 integration: inject cash < claimable -> ReconMismatch HALT.
// Against the local chain + seeded read model, warp anvil forward so the anchor position
// accrues on-chain claimable > 0, then drive the off-chain collected reserve BELOW that
// claimable. runReconCycle must return {ok:false, state:'ReconMismatch', failed:'ClaimableCovered'},
// write exactly 1 halt recon_status row, flip isDistributionHalted true, and make
// assertCanDistribute throw. A subsequent funded cycle clears the halt and re-opens distribution.
import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestClient, http, publicActions } from "viem";
import { usdc6, type Sql } from "@pcl/shared";
import { makeChainClient, backfill } from "../../indexer/src/index.ts";
import { loadManifest, tokenAddresses, tokenToLoanMap } from "../../indexer/src/manifest.ts";
import { seedReference } from "../../indexer/src/seed.ts";
import { anvilLocal } from "../../indexer/src/client.ts";
import { runReconCycle } from "../src/recon/engine.ts";
import { loadSnapshot } from "../src/recon/snapshot.ts";
import { isDistributionHalted, assertCanDistribute } from "../src/recon/halt.ts";
import { DistributionHalted } from "../src/recon/types.ts";
import { ingestNav } from "../src/nav/gate.ts";
import { freshMigratedDb } from "../../shared/test/db.helper.ts";
import { bps, loanId, unixSeconds } from "@pcl/shared";

const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";

let db: Awaited<ReturnType<typeof freshMigratedDb>>;
let sql: Sql;
const chain = makeChainClient(LOCAL_RPC, 31337);
// a test client so we can warp anvil time to accrue on-chain claimable.
const testClient = createTestClient({ chain: anvilLocal, mode: "anvil", transport: http(LOCAL_RPC) }).extend(publicActions);

beforeAll(async () => {
  db = await freshMigratedDb("pcl_recon10");
  sql = db.sql;
  const manifest = loadManifest(31337);
  await seedReference(sql, manifest);
  const latest = await chain.getBlockNumber();
  await backfill(sql, chain, tokenAddresses(manifest), tokenToLoanMap(manifest), 0n, latest);

  // warp ~30 days so the PERFORMING anchor loan accrues a non-trivial on-chain claimable.
  await testClient.increaseTime({ seconds: 30 * 24 * 3600 });
  await testClient.mine({ blocks: 1 });
});

afterAll(async () => {
  await db.dispose();
});

const manifest = loadManifest(31337);

test("on-chain claimable is now positive (accrual accumulated)", async () => {
  const snap = await loadSnapshot(sql, chain, manifest);
  expect(snap.onchainClaimableTotal > 0n).toBe(true);
});

test("row 10: collected < claimable -> ReconMismatch/ClaimableCovered, halts distribution", async () => {
  const snap = await loadSnapshot(sql, chain, manifest);
  const claimable = snap.onchainClaimableTotal;
  // inject off-chain collected cash strictly below claimable.
  const shortfall = (claimable - usdc6(1n)) as bigint;
  await sql`insert into reserve (id, balance, updated_at) values (1, ${shortfall.toString()}, 0) on conflict (id) do update set balance = ${shortfall.toString()}`;

  const res = await runReconCycle(sql, chain, manifest);
  expect(res).toMatchObject({ ok: false, state: "ReconMismatch", failed: "ClaimableCovered" });

  const halts = await sql<{ count: bigint }[]>`select count(*)::bigint as count from recon_status where ok = false and state = 'ReconMismatch'`;
  expect(halts[0]?.count).toBe(1n);
  expect(await isDistributionHalted(sql)).toBe(true);
  await expect(assertCanDistribute(sql)).rejects.toBeInstanceOf(DistributionHalted);
});

test("a funded cycle (collected >= claimable) passes and re-opens distribution", async () => {
  const snap = await loadSnapshot(sql, chain, manifest);
  // fund collected generously above claimable.
  const funded = (snap.onchainClaimableTotal + usdc6(1_000_000n)) as bigint;
  await sql`update reserve set balance = ${funded.toString()} where id = 1`;

  const res = await runReconCycle(sql, chain, manifest);
  expect(res.ok).toBe(true);
  if (res.ok) expect(res.stateHash).toMatch(/^0x[0-9a-f]{64}$/);
  expect(await isDistributionHalted(sql)).toBe(false);
  await expect(assertCanDistribute(sql)).resolves.toBeUndefined();
});

test("#45 each cycle persists the snapshot's aggregate claimable to reserve.total_claimable", async () => {
  // anvil time only advances on mining, so claimable() is stable between the cycle above and
  // this read — the persisted value must equal a fresh snapshot's total exactly.
  const snap = await loadSnapshot(sql, chain, manifest);
  const rows = await sql<{ total_claimable: string }[]>`select total_claimable::text as total_claimable from reserve where id = 1`;
  expect(rows[0]?.total_claimable).toBe(snap.onchainClaimableTotal.toString());
  // and it is genuinely live (this world accrued ~30 days of interest), not the dead accrued sum.
  expect(BigInt(rows[0]?.total_claimable ?? "0") > 0n).toBe(true);
});

test("I3 break: an anomalous NAV makes the cycle HALT with state NavAnomaly", async () => {
  const now = unixSeconds(1_700_000_700);
  // accepted baseline then a +40% spike on the anchor loan -> NavAnomaly halt + frozen accrual.
  await ingestNav(sql, { loan: loanId(1), navBps: bps(10000), observedAt: unixSeconds(1_700_000_000), source: "t" }, now);
  await ingestNav(sql, { loan: loanId(1), navBps: bps(14000), observedAt: unixSeconds(1_700_000_100), source: "t" }, now);

  // reserve stays funded so ONLY I3 can break -> the engine maps it to NavAnomaly, not ReconMismatch.
  const res = await runReconCycle(sql, chain, manifest);
  expect(res).toMatchObject({ ok: false, state: "NavAnomaly", failed: "NavInBounds" });
});
