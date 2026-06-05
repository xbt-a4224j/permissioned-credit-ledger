// #24 query-doc validity — the UI's GraphQL never drifts from the #20 schema.
// Parses each query document with graphql's parse (syntactic validity) and validates it against the
// committed SDL snapshot (api/schema.graphql) so a renamed/removed field fails the build here rather
// than returning null at runtime — the ABI-drift landmine, applied to the GraphQL boundary.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSchema, parse, validate } from "graphql";
import { LOANS_QUERY, POSITIONS_QUERY } from "./queries.ts";

// #24 load the committed SDL snapshot the resolvers (#21) print from the Pothos schema (#20).
// Resolve from the web workspace cwd (vitest runs with cwd = web/) so it works under jsdom.
const sdlPath = resolve(process.cwd(), "../api/schema.graphql");
const schema = buildSchema(readFileSync(sdlPath, "utf8"));

describe("query documents", () => {
  it("LOANS_QUERY parses and validates against the SDL snapshot", () => {
    const doc = parse(LOANS_QUERY);
    expect(doc.kind).toBe("Document");
    expect(validate(schema, doc)).toEqual([]);
  });

  it("POSITIONS_QUERY parses and validates against the SDL snapshot", () => {
    const doc = parse(POSITIONS_QUERY);
    expect(doc.kind).toBe("Document");
    expect(validate(schema, doc)).toEqual([]);
  });

  it("selects only money fields that exist as BigIntStr in the SDL", () => {
    // a guard that the snapshot still carries the fields the UI decodes to bigint.
    const sdl = readFileSync(sdlPath, "utf8");
    expect(sdl).toContain("principal: BigIntStr!");
    expect(sdl).toContain("accrued: BigIntStr!");
    expect(sdl).toContain("claimable: BigIntStr!");
  });
});
