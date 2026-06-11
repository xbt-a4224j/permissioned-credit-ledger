// #25 reason-code taxonomy — exhaustive, tone-partitioned, and pinned to the #20 SDL enum.
// Correctness is typed: REASON_META covers every ReasonCode (exhaustiveness), the 7 transfer/claim/
// issuance codes are tone 'block' and the 2 engine HALTs are tone 'halt', isReasonCode rejects garbage, and
// the union equals the committed GraphQL ReasonCode enum (api/schema.graphql) so a renamed code on
// either side fails the build — the ABI/enum-drift landmine applied to the reason taxonomy.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSchema, GraphQLEnumType } from "graphql";
import { REASON_CODES, REASON_META, isReasonCode } from "./reasonCodes.ts";

const sdl = buildSchema(readFileSync(resolve(process.cwd(), "../api/schema.graphql"), "utf8"));

describe("ReasonCode taxonomy", () => {
  it("REASON_META has an entry for every ReasonCode (exhaustiveness)", () => {
    for (const code of REASON_CODES) expect(REASON_META[code]).toBeDefined();
    expect(Object.keys(REASON_META).length).toBe(REASON_CODES.length);
    expect(REASON_CODES.length).toBe(9);
  });

  it("partitions tones: 7 block (on-chain reverts) + 2 halt (engine states)", () => {
    const block = REASON_CODES.filter((c) => REASON_META[c].tone === "block");
    const halt = REASON_CODES.filter((c) => REASON_META[c].tone === "halt");
    expect(block).toEqual(["SenderFrozen", "NotEligible", "ReceiverFrozen", "ReceiverNotVerified", "AccreditationRequired", "InsufficientReserve", "ExceedsPrincipal"]);
    expect(halt).toEqual(["NavAnomaly", "ReconMismatch"]);
  });

  it("isReasonCode rejects an unknown string and accepts a known one", () => {
    expect(isReasonCode("NotEligible")).toBe(true);
    expect(isReasonCode("Whoops")).toBe(false);
    expect(isReasonCode("")).toBe(false);
  });

  it("the union equals the committed GraphQL ReasonCode enum (drift guard)", () => {
    const enumType = sdl.getType("ReasonCode");
    expect(enumType).toBeInstanceOf(GraphQLEnumType);
    // graphql enum values, as a sorted set.
    const sdlValues = (enumType as GraphQLEnumType).getValues().map((v) => v.name).sort();
    expect(sdlValues).toEqual([...REASON_CODES].sort());
    // and the matrix reason codes are a subset (rows 3-6,8 + engine HALTs 9-10).
    const matrix = ["SenderFrozen", "NotEligible", "ReceiverFrozen", "ReceiverNotVerified", "AccreditationRequired", "InsufficientReserve", "NavAnomaly", "ReconMismatch"];
    for (const m of matrix) expect(REASON_CODES).toContain(m);
  });
});
