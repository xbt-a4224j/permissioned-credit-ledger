// On-Chain Layer · #21 decodeReason — typed custom-error mapping + totality.
// The matrix asserts a specific typed failure per branch; decodeReason is where an opaque revert
// becomes one of the 5 on-chain ReasonCodes. Encode each custom error's revert data with viem and
// assert it maps to the right code; assert an unknown selector returns null; and prove (fast-check)
// the function is TOTAL — any bytes return a ReasonCode or null, never a throw.
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { encodeErrorResult, toHex } from "viem";
import { decodeReason } from "../src/chain/errors.ts";
import { COMBINED_ERROR_ABI } from "../src/chain/abi.ts";

const ADDR = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as const;

// helper: build the raw revert data for a named custom error from the combined ABI.
function revertData(errorName: string, args: readonly unknown[]): `0x${string}` {
  return encodeErrorResult({ abi: COMBINED_ERROR_ABI, errorName, args });
}

describe("#21 decodeReason maps the 5 on-chain custom errors", () => {
  test("NotEligible -> NotEligible", () => {
    expect(decodeReason(revertData("NotEligible", [ADDR]))).toBe("NotEligible");
  });
  test("ReceiverFrozen -> ReceiverFrozen", () => {
    expect(decodeReason(revertData("ReceiverFrozen", [ADDR]))).toBe("ReceiverFrozen");
  });
  test("ReceiverNotVerified -> ReceiverNotVerified", () => {
    expect(decodeReason(revertData("ReceiverNotVerified", [ADDR]))).toBe("ReceiverNotVerified");
  });
  test("AccreditationRequired -> AccreditationRequired", () => {
    expect(decodeReason(revertData("AccreditationRequired", [ADDR]))).toBe("AccreditationRequired");
  });
  test("InsufficientReserve -> InsufficientReserve", () => {
    expect(decodeReason(revertData("InsufficientReserve", [1000n, 500n]))).toBe("InsufficientReserve");
  });

  test("an unknown selector returns null (not a guess)", () => {
    // AccessControlUnauthorizedAccount is a real revert but NOT a ReasonCode -> null.
    const ac = revertData("AccessControlUnauthorizedAccount", [ADDR, toHex(0, { size: 32 })]);
    expect(decodeReason(ac)).toBeNull();
    // arbitrary 4-byte garbage -> null.
    expect(decodeReason("0xdeadbeef")).toBeNull();
  });

  test("non-error inputs never throw and return null", () => {
    expect(decodeReason(undefined)).toBeNull();
    expect(decodeReason(null)).toBeNull();
    expect(decodeReason(new Error("plain"))).toBeNull();
    expect(decodeReason({ nope: true })).toBeNull();
  });

  test("property: decodeReason is total over arbitrary revert bytes (256 runs)", () => {
    const REASONS = new Set([
      "NotEligible",
      "ReceiverFrozen",
      "ReceiverNotVerified",
      "AccreditationRequired",
      "InsufficientReserve",
    ]);
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 100 }), (bytes) => {
        const data = toHex(bytes);
        let result: unknown;
        // must never throw.
        expect(() => {
          result = decodeReason(data);
        }).not.toThrow();
        // must be null or a member of the 5 on-chain reason codes.
        return result === null || REASONS.has(result as string);
      }),
      { numRuns: 256 },
    );
  });
});
