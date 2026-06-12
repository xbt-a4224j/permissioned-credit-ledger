// #20 schema assertions — the frozen GraphQL contract.
// The schema is the surface the UI (#24-26) and the matrix verifier (#27) build against, so its
// shape is pinned here: exactly 6 mutations (3 writes + 2 ops + KYC), the core query fields, the
// 8-member ReasonCode enum, the 4 named invariants, no schema-validation errors, and the BigIntStr
// scalar round-tripping uint256 max with zero precision loss (a fast-check property — the IEEE-754 guard).
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import type { GraphQLEnumType, GraphQLObjectType, GraphQLScalarType } from "graphql";
import { schema, validateBuiltSchema } from "../src/schema/index.ts";

// the built GraphQLScalarType carries the serialize/parseValue functions (the Pothos `scalarType`
// return is a ref, not the executable scalar — so read it off the assembled schema).
const BigIntStr = schema.getType("BigIntStr") as GraphQLScalarType;

describe("#20 GraphQL schema contract", () => {
  test("schema validates with zero errors", () => {
    expect(validateBuiltSchema()).toEqual([]);
  });

  test("the write mutations (invest/transfer/claim) + #38 ops (submitNav/reportCash) + #39 KYC (submitKyc)", () => {
    const mutation = schema.getMutationType() as GraphQLObjectType;
    expect(Object.keys(mutation.getFields()).sort()).toEqual(["claim", "invest", "reportCash", "submitKyc", "submitNav", "transfer"]);
  });

  test("the core query fields (+ txStatus from #23) are present", () => {
    const query = schema.getQueryType() as GraphQLObjectType;
    const fields = Object.keys(query.getFields());
    for (const f of ["loans", "loan", "position", "positions", "reserve", "reconciliationStatus"]) {
      expect(fields).toContain(f);
    }
    expect(fields).toContain("txStatus");
  });

  test("ReasonCode enum exposes exactly the 9 typed codes", () => {
    const reason = schema.getType("ReasonCode") as GraphQLEnumType;
    const values = reason.getValues().map((v) => v.name);
    expect(values.length).toBe(9);
    expect(new Set(values)).toEqual(
      new Set([
        "SenderFrozen",
        "NotEligible",
        "ReceiverFrozen",
        "ReceiverNotVerified",
        "AccreditationRequired",
        "InsufficientReserve",
        "ExceedsPrincipal",
        "NavAnomaly",
        "ReconMismatch",
      ]),
    );
  });

  test("ReconState + TxState enums are the expected closed sets", () => {
    const reconState = schema.getType("ReconState") as GraphQLEnumType;
    expect(new Set(reconState.getValues().map((v) => v.name))).toEqual(new Set(["OK", "HALTED"]));
    const txState = schema.getType("TxState") as GraphQLEnumType;
    expect(new Set(txState.getValues().map((v) => v.name))).toEqual(new Set(["PENDING", "CONFIRMED", "REVERTED"]));
  });

  test("ReconciliationStatus.invariants declares the 4 invariant names via InvariantResult", () => {
    // the 4 names are resolved per-row in #21; here we assert the InvariantResult shape exists
    // with a `name` field and ReconciliationStatus carries a non-null invariants list.
    const recon = schema.getType("ReconciliationStatus") as GraphQLObjectType;
    expect(Object.keys(recon.getFields())).toContain("invariants");
    const inv = schema.getType("InvariantResult") as GraphQLObjectType;
    expect(Object.keys(inv.getFields())).toEqual(expect.arrayContaining(["name", "ok", "onchain", "offchain", "delta"]));
  });

  test("the 4 invariant names map 1:1 with the engine (recon-reader source of truth)", async () => {
    const { readReconStatus } = await import("../src/recon-reader.ts");
    // readReconStatus with no cycle returns all 4 invariant rows named exactly.
    const names = (await readReconStatus(fakeEmptySql())).invariants.map((i) => i.name);
    expect(names).toEqual(["supplyBacked", "claimableCovered", "navInBounds", "identityValid"]);
  });

  test("BigIntStr round-trips uint256 max losslessly", () => {
    const max = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    expect(BigIntStr.serialize(max)).toBe(max);
    expect(BigIntStr.parseValue(max)).toBe(max);
  });

  test("property: BigIntStr is precision-exact over any uint256", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: (1n << 256n) - 1n }), (x) => {
        const s = x.toString();
        // serialize(parse(x)) === x.toString() — no widening to a lossy number.
        return BigIntStr.serialize(BigIntStr.parseValue(s)) === s;
      }),
      { numRuns: 256 },
    );
  });
});

// a minimal Sql stub: readReconStatus issues exactly one tagged-template query and reads rows[0].
// With no rows it takes the genesis branch (all-4-green), which is what this test asserts.
function fakeEmptySql(): import("@pcl/shared").Sql {
  const tag = (): Promise<unknown[]> => Promise.resolve([]);
  return tag as unknown as import("@pcl/shared").Sql;
}
