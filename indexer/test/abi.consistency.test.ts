// #16 ABI-drift guard: the inline event fragments == the compiled artifact.
// abi.ts pins the 5 CreditToken event fragments `as const` for viem inference; if the compiled
// ABI ever diverges (a renamed param, a flipped `indexed`), decoding silently mis-parses (the
// ABI-drift landmine). This test fails loudly the moment they disagree.
import { describe, expect, test } from "vitest";
import { CREDIT_TOKEN_ARTIFACT, CREDIT_TOKEN_EVENTS } from "../src/abi.ts";

type AbiEventInput = { name: string; type: string; indexed?: boolean };
type AbiEvent = { type: string; name: string; inputs: AbiEventInput[] };

const artifactEvents = (CREDIT_TOKEN_ARTIFACT.abi as AbiEvent[]).filter((x) => x.type === "event");

describe("inline CreditToken event fragments match the compiled artifact", () => {
  for (const frag of CREDIT_TOKEN_EVENTS) {
    test(`${frag.name} fragment matches artifact`, () => {
      const fromArtifact = artifactEvents.find((e) => e.name === frag.name);
      expect(fromArtifact, `${frag.name} missing from artifact ABI`).toBeDefined();
      const norm = (inputs: readonly AbiEventInput[]): AbiEventInput[] =>
        inputs.map((i) => ({ name: i.name, type: i.type, indexed: Boolean(i.indexed) }));
      expect(norm(fromArtifact!.inputs)).toEqual(norm(frag.inputs));
    });
  }
});
