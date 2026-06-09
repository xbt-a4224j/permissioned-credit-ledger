// #21 mutation resolvers — the seam: HALT gate, typed reverts, real broadcasts.
// The verify gate's core. Against the local anvil + seeded read model:
//  • invest (accredited-US) broadcasts and returns a PENDING ref + an optimistic position (row 1).
//  • claim (anchor holder) broadcasts (row 7).
//  • each eligibility branch surfaces its TYPED ReasonCode via simulateContract, not an RPC string:
//    unverified invest -> NotEligible/ReceiverNotVerified; transfer-to-frozen -> ReceiverFrozen;
//    transfer-to-unverified -> ReceiverNotVerified; US-non-accredited never seeded, so we assert
//    the gauntlet's verified/eligible branches (rows 3-5) + claim InsufficientReserve (row 8).
//  • when recon is HALTED, claim/invest throw a ReconMismatch/NavAnomaly code and NEVER call
//    writeContract (matrix rows 9-10 enforced at the API, not just displayed).
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { GraphQLError } from "graphql";
import { createTestClient, http, publicActions, type PublicClient, type WalletClient } from "viem";
import type { Sql } from "@pcl/shared";
import type { Manifest } from "../../indexer/src/index.ts";
import { anvilLocal } from "../../indexer/src/index.ts";
import {
  seededDb,
  buildContext,
  realChain,
  LOCAL_RPC,
  ACCREDITED_US_1,
  ACCREDITED_US_1_KEY,
  ACCREDITED_US_2,
  REG_S_NONUS_1,
  UNVERIFIED,
  FROZEN,
} from "./helpers.ts";
import { resolveInvest, resolveTransfer, resolveClaim } from "../src/resolvers/mutations.ts";
import type { ApiContext } from "../src/context.ts";

let sql: Sql;
let manifest: Manifest;
let dispose: () => Promise<void>;
let ctx: ApiContext; // issuer signer (account 0): invest/transfer.
let holderCtx: ApiContext; // anchor holder signer (account 1): claim (msg.sender-driven).
// anvil test client to warp time so the anchor accrues claimable for the claim path.
const testClient = createTestClient({ chain: anvilLocal, mode: "anvil", transport: http(LOCAL_RPC) }).extend(publicActions);
// snapshot the chain at suite start; this suite BROADCASTS (mints/claims/warps), so revert at the
// end restores the post-deploy state every other suite backfills from (no cross-suite drift).
let chainSnapshot: `0x${string}`;

beforeAll(async () => {
  chainSnapshot = await testClient.snapshot();
  const db = await seededDb("pcl_m");
  sql = db.sql;
  manifest = db.manifest;
  dispose = db.dispose;
  ctx = buildContext(sql, manifest, realChain());
  holderCtx = buildContext(sql, manifest, realChain(ACCREDITED_US_1_KEY));
});

afterAll(async () => {
  await dispose();
  // roll back every broadcast + time warp this suite made so anvil returns to the deploy state.
  await testClient.revert({ id: chainSnapshot });
});

// --- happy paths (real broadcasts against anvil) ---

test("invest (accredited-US, RegD loan 1) broadcasts + writes an optimistic position (row 1)", async () => {
  const res = await resolveInvest(ctx, { loanId: "1", wallet: ACCREDITED_US_2, amount: "1000000000" });
  expect(res.state).toBe("PENDING");
  expect(res.hash).toMatch(/^0x[0-9a-f]{64}$/);
  // optimistic position attached + persisted (count 1 for this hash).
  expect(res.position?.optimistic).toBe(true);
  expect(typeof res.position?.principal).toBe("string");
  const txRows = await sql<{ count: bigint }[]>`select count(*)::bigint as count from tx_status where hash = ${res.hash} and state = 'PENDING'`;
  expect(txRows[0]?.count).toBe(1n);
  const optRows = await sql<{ count: bigint }[]>`select count(*)::bigint as count from optimistic_positions where hash = ${res.hash}`;
  expect(optRows[0]?.count).toBe(1n);
});

test("invest amount is carried as a string end to end (no IEEE-754 widening)", async () => {
  const big = "123456789012345"; // > 2^53
  const res = await resolveInvest(ctx, { loanId: "2", wallet: ACCREDITED_US_2, amount: big });
  expect(res.position?.principal).toBe(big);
});

test("claim (anchor holder, funded reserve) broadcasts (row 7)", async () => {
  // warp so the anchor accrues a little claimable; reserve was funded at deploy (1M).
  await testClient.increaseTime({ seconds: 7 * 24 * 3600 });
  await testClient.mine({ blocks: 1 });
  const res = await resolveClaim(holderCtx, { loanId: "1", wallet: ACCREDITED_US_1 });
  expect(res.state).toBe("PENDING");
  expect(res.hash).toMatch(/^0x[0-9a-f]{64}$/);
});

// --- typed error paths (simulateContract surfaces the typed custom error) ---

test("unverified invest -> NotEligible/ReceiverNotVerified (rows 3)", async () => {
  await expect(resolveInvest(ctx, { loanId: "1", wallet: UNVERIFIED, amount: "1000" })).rejects.toMatchObject({
    extensions: { code: expect.stringMatching(/NotEligible|ReceiverNotVerified/) },
  });
});

test("transfer to a frozen receiver -> ReceiverFrozen (row 4)", async () => {
  await expect(resolveTransfer(ctx, { loanId: "1", from: ACCREDITED_US_1, to: FROZEN, amount: "1000" })).rejects.toMatchObject({
    extensions: { code: "ReceiverFrozen" },
  });
});

test("transfer to an unverified receiver -> ReceiverNotVerified (row 5)", async () => {
  await expect(resolveTransfer(ctx, { loanId: "1", from: ACCREDITED_US_1, to: UNVERIFIED, amount: "1000" })).rejects.toMatchObject({
    extensions: { code: "ReceiverNotVerified" },
  });
});

test("Reg-S loan transfer to a US holder -> NotEligible (row 6 variant)", async () => {
  // loan 3 is RegS; ACCREDITED_US_2 is US -> the RegS branch reverts NotEligible.
  await expect(resolveTransfer(ctx, { loanId: "3", from: REG_S_NONUS_1, to: ACCREDITED_US_2, amount: "1000" })).rejects.toMatchObject({
    extensions: { code: "NotEligible" },
  });
});

test("claim with an over-drained reserve -> InsufficientReserve (row 8)", async () => {
  // snapshot so the huge warp below doesn't leak into other suites sharing this anvil.
  const snap = await testClient.snapshot();
  try {
    // warp far enough that owed exceeds the funded reserve (1M USDC). Anchor accrues ~100 base
    // units/sec (1e11 tokens * 1e9 rate / 1e18 scale), so > ~1.16e8 days clears 1e12 owed.
    await testClient.increaseTime({ seconds: 300_000 * 24 * 3600 });
    await testClient.mine({ blocks: 1 });
    await expect(resolveClaim(holderCtx, { loanId: "1", wallet: ACCREDITED_US_1 })).rejects.toMatchObject({
      extensions: { code: "InsufficientReserve" },
    });
  } finally {
    await testClient.revert({ id: snap });
  }
});

// --- the HALT gate (matrix rows 9-10) ---

test("when recon is HALTED (ReconMismatch), claim throws the typed code and NEVER writes", async () => {
  // insert a halting recon_status row.
  await sql`insert into recon_status (ok, state, failed_invariant, state_hash, detail) values (false, 'ReconMismatch', 'ClaimableCovered', '0xhalt', null)`;

  // a spy chain so we can assert writeContract is not called.
  const writeSpy = vi.fn();
  const simulateSpy = vi.fn();
  const haltedCtx = buildContext(sql, manifest, {
    publicClient: { simulateContract: simulateSpy } as unknown as PublicClient,
    walletClient: { writeContract: writeSpy } as unknown as WalletClient,
    account: ctx.chain.account,
  });

  await expect(resolveClaim(haltedCtx, { loanId: "1", wallet: ACCREDITED_US_1 })).rejects.toMatchObject({
    extensions: { code: "ReconMismatch" },
  });
  await expect(resolveInvest(haltedCtx, { loanId: "1", wallet: ACCREDITED_US_2, amount: "1000" })).rejects.toMatchObject({
    extensions: { code: "ReconMismatch" },
  });
  // the gate precedes the chain: neither simulate nor write was touched.
  expect(simulateSpy).not.toHaveBeenCalled();
  expect(writeSpy).not.toHaveBeenCalled();
});

test("HALTED errors are GraphQLError instances (typed, not strings)", async () => {
  // recon still HALTED from the prior test (sticky until a clean cycle).
  const haltedCtx = buildContext(sql, manifest, {
    publicClient: { simulateContract: vi.fn() } as unknown as PublicClient,
    walletClient: { writeContract: vi.fn() } as unknown as WalletClient,
    account: ctx.chain.account,
  });
  await expect(resolveClaim(haltedCtx, { loanId: "1", wallet: ACCREDITED_US_1 })).rejects.toBeInstanceOf(GraphQLError);
});
