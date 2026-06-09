// #19 golden: the seed replay hash is pinned, and the hash is sensitive (not vacuous).
// stateHash(replay(seedInputs)) must equal the committed golden.json hash — a logic change that
// alters state surfaces here as a diff. And a deliberate 1-base-unit perturbation of an input
// MUST change the hash, proving the fingerprint actually depends on the values.
import { afterAll, beforeAll, expect, test } from "vitest";
import { eventId, identityAddr, loanId, usdc6, type ChainEvent, type Sql } from "@pcl/shared";
import { makeChainClient, backfill } from "../../indexer/src/index.ts";
import { loadManifest, tokenAddresses, tokenToLoanMap } from "../../indexer/src/manifest.ts";
import { seedReference } from "../../indexer/src/seed.ts";
import { loadInputs, replay } from "../src/replay/replay.ts";
import { stateHash } from "../src/replay/hash.ts";
import { runReconCycle } from "../src/recon/engine.ts";
import golden from "../src/replay/golden.json" with { type: "json" };
import { freshMigratedDb } from "../../shared/test/db.helper.ts";
import type { ReplayInput } from "../src/replay/types.ts";

const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";

let db: Awaited<ReturnType<typeof freshMigratedDb>>;
let sql: Sql;

beforeAll(async () => {
  db = await freshMigratedDb("pcl_golden");
  sql = db.sql;
  const m = loadManifest(31337);
  await seedReference(sql, m);
  const chain = makeChainClient(LOCAL_RPC, 31337);
  const latest = await chain.getBlockNumber();
  await backfill(sql, chain, tokenAddresses(m), tokenToLoanMap(m), 0n, latest);
});

afterAll(async () => {
  await db.dispose();
});

test("stateHash(replay(seedInputs)) equals the committed golden hash", async () => {
  const inputs = await loadInputs(sql);
  expect(stateHash(replay(inputs))).toBe(golden.hash);
});

test("the live runReconCycle state_hash equals a cold replay hash for the same snapshot", async () => {
  // fund collected so the cycle passes (we only care that the persisted state_hash == replay).
  await sql`insert into reserve (id, balance, updated_at) values (1, 1000000000000, 0) on conflict (id) do update set balance = 1000000000000`;
  const chain = makeChainClient(LOCAL_RPC, 31337);
  const res = await runReconCycle(sql, chain, loadManifest(31337));
  expect(res.ok).toBe(true);

  const cold = stateHash(replay(await loadInputs(sql)));
  const persisted = (await sql<{ state_hash: string }[]>`select state_hash from recon_status order by cycle_id desc limit 1`)[0]?.state_hash;
  if (res.ok) expect(res.stateHash).toBe(cold);
  expect(persisted).toBe(cold);
  // and it matches the seed golden (no chain/nav mutations beyond the seed + a reserve row,
  // which replay's loadInputs does not read — reserve is folded from InterestClaimed only).
  expect(cold).toBe(golden.hash);
});

test("a 1-base-unit perturbation of any input changes the hash", async () => {
  const inputs = await loadInputs(sql);
  const baseline = stateHash(replay(inputs));

  // perturb the anchor PositionOpened's paired Transfer amount by exactly 1 base unit.
  const perturbed: ReplayInput[] = inputs.map((i) => {
    if (i.kind === "chain" && i.event.name === "Transfer") {
      const ev = i.event as Extract<ChainEvent, { name: "Transfer" }>;
      return { kind: "chain", event: { ...ev, amount: usdc6((ev.amount + 1n) as bigint) } };
    }
    return i;
  });
  expect(stateHash(replay(perturbed))).not.toBe(baseline);
});

test("a synthetic 1-unit principal change is detectable in isolation", () => {
  const token = identityAddr("0x8a791620dd6260079bf849dc5567adc3f2fdc318");
  const zero = identityAddr("0x0000000000000000000000000000000000000000");
  const holder = identityAddr("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
  const mk = (amount: bigint): ReplayInput[] => [
    { kind: "chain", event: { id: eventId("0x" + "a".repeat(64), 0), name: "Transfer", blockNumber: 1n, logIndex: 0, token, loan: loanId(1), from: zero, to: holder, amount: usdc6(amount) } },
  ];
  expect(stateHash(replay(mk(1000n)))).not.toBe(stateHash(replay(mk(1001n))));
});
