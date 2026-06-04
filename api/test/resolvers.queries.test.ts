// Money Layer · #21 query resolvers read the seeded read models (no chain).
// Against a migrated + manifest-seeded + backfilled db: loans returns the 6 mortgages,
// reconciliationStatus exposes the 4 named invariants, the anchor holder's position is present,
// and every BigIntStr field is a string (the IEEE-754 landmine guard from #20).
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Sql } from "@pcl/shared";
import type { Manifest } from "../../indexer/src/index.ts";
import { seededDb, buildContext, realChain, ACCREDITED_US_1 } from "./helpers.ts";
import {
  resolveLoans,
  resolveLoan,
  resolvePositions,
  resolveReserve,
  resolveReconciliationStatus,
} from "../src/resolvers/queries.ts";
import type { ApiContext } from "../src/context.ts";

let sql: Sql;
let manifest: Manifest;
let dispose: () => Promise<void>;
let ctx: ApiContext;

beforeAll(async () => {
  const db = await seededDb("pcl_q");
  sql = db.sql;
  manifest = db.manifest;
  dispose = db.dispose;
  ctx = buildContext(sql, manifest, realChain());
});

afterAll(async () => {
  await dispose();
});

test("loans returns the 6 seeded mortgages, ordered", async () => {
  const loans = await resolveLoans(ctx);
  expect(loans.length).toBe(6);
  expect(loans.map((l) => l.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
});

test("every loan money field is a decimal string (BigIntStr), never a number", async () => {
  const loans = await resolveLoans(ctx);
  for (const l of loans) {
    expect(typeof l.principal).toBe("string");
    expect(typeof l.ratePerSecond).toBe("string");
    expect(l.principal).toMatch(/^\d+$/);
    expect(l.ratePerSecond).toMatch(/^\d+$/);
  }
});

test("loan(id) maps DEFAULT -> Matured and resolves the residential seam loan", async () => {
  const loan5 = await resolveLoan(ctx, "5"); // DEFAULT in the manifest
  expect(loan5?.status).toBe("Matured");
  const loan6 = await resolveLoan(ctx, "6"); // RESIDENTIAL, PERFORMING
  expect(loan6?.status).toBe("Active");
  expect(await resolveLoan(ctx, "999")).toBeNull();
});

test("the anchor holder has the seeded position on loan 1", async () => {
  const positions = await resolvePositions(ctx, ACCREDITED_US_1);
  const onLoan1 = positions.find((p) => p.loanId === "1");
  expect(onLoan1).toBeDefined();
  expect(typeof onLoan1?.principal).toBe("string");
  expect(BigInt(onLoan1!.principal)).toBe(100_000_000_000n); // 100_000e6 anchor
  expect(onLoan1?.optimistic).toBe(false);
});

test("reconciliationStatus returns the 4 named invariants", async () => {
  const status = await resolveReconciliationStatus(ctx);
  expect(status.invariants.length).toBe(4);
  expect(status.invariants.map((i) => i.name)).toEqual(["supplyBacked", "claimableCovered", "navInBounds", "identityValid"]);
});

test("reserve exposes balance + totalClaimable as strings", async () => {
  const reserve = await resolveReserve(ctx);
  expect(typeof reserve.balance).toBe("string");
  expect(typeof reserve.totalClaimable).toBe("string");
  expect(reserve.balance).toMatch(/^\d+$/);
});
