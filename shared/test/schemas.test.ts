// #14 schema round-trip + rejection coverage, brand nominality, union closure.
// (#44: zod -> ArkType.) ArkType Types are called, not `.parse`d; `.assert(data)` is the
// throw-on-invalid analogue of zod's `.parse` — it returns the morphed (branded) value or throws.
import { describe, expect, test } from "vitest";
import {
  ChainEventSchema,
  IdentitySchema,
  LoanSchema,
  NavReadingSchema,
  PositionSchema,
  PropertySchema,
  ReserveStateSchema,
} from "../src/schemas.ts";
import { usdc6, usdc6FromString, usdc6ToString, type Usdc6 } from "../src/brand.ts";
import { assertNever, type DomainError } from "../src/reasons.ts";

// #14 each schema round-trips a valid fixture (>=8 assertions across schemas).
describe("arktype schemas round-trip valid fixtures", () => {
  test("Property", () => {
    const p = PropertySchema.assert({ id: "1", addressLabel: "100 Market St", appraisedValue: "7700000000000", lienPosition: 1 });
    expect(p.id).toBe("1");
    expect(p.appraisedValue).toBe(7_700_000_000_000n);
  });

  test("Loan (mortgage-general)", () => {
    const l = LoanSchema.assert({
      id: 1,
      principal: "5000000000000",
      rateBps: 850,
      status: "PERFORMING",
      startedAt: 1_700_000_000,
      collateralType: "CRE",
      propertyId: 1,
      ltvBps: 6500,
      dscrBps: 14000,
    });
    expect(l.principal).toBe(5_000_000_000_000n);
    expect(l.collateralType).toBe("CRE");
    expect(l.status).toBe("PERFORMING");
  });

  test("Loan accepts RESIDENTIAL (the seam)", () => {
    const l = LoanSchema.assert({
      id: 6, principal: "850000000000", rateBps: 500, status: "PERFORMING", startedAt: 1,
      collateralType: "RESIDENTIAL", propertyId: 6, ltvBps: 8500, dscrBps: 13000,
    });
    expect(l.collateralType).toBe("RESIDENTIAL");
  });

  test("Identity", () => {
    const i = IdentitySchema.assert({ addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", verified: true });
    expect(i.addr).toBe("0x70997970c51812dc3a010c7d01b50e0d17dc79c8"); // lowercased
  });

  test("Position", () => {
    const p = PositionSchema.assert({ id: "1:0xabc", loan: 1, holder: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", principal: "100000000000", accrued: "0", openedAt: 1 });
    expect(p.accrued).toBe(0n);
  });

  test("ChainEvent PositionOpened", () => {
    const e = ChainEventSchema.assert({
      id: { txHash: "0x" + "a".repeat(64), logIndex: 0 },
      name: "PositionOpened", blockNumber: 5n, logIndex: 0,
      token: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
      holder: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", loan: 1, amount: "100000000000",
    });
    expect(e.name).toBe("PositionOpened");
    if (e.name === "PositionOpened") expect(e.amount).toBe(100_000_000_000n);
  });

  test("ChainEvent LoanStatusChanged", () => {
    const e = ChainEventSchema.assert({
      id: { txHash: "0x" + "b".repeat(64), logIndex: 2 },
      name: "LoanStatusChanged", blockNumber: 3n, logIndex: 2,
      token: "0x9A676e781A523b5d0C0e43731313A708CB607508", loan: 5, status: "DEFAULT",
    });
    if (e.name === "LoanStatusChanged") expect(e.status).toBe("DEFAULT");
  });

  test("ChainEvent ClaimsUpdated (the KYC event — registry-emitted, no loan)", () => {
    const e = ChainEventSchema.assert({
      id: { txHash: "0x" + "c".repeat(64), logIndex: 1 },
      name: "ClaimsUpdated", blockNumber: 9n, logIndex: 1,
      token: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // the IdentityRegistry that emitted it
      account: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      verified: true,
    });
    if (e.name === "ClaimsUpdated") {
      expect(e.account).toBe("0x70997970c51812dc3a010c7d01b50e0d17dc79c8"); // lowercased
      expect(e.verified).toBe(true);
    }
  });

  test("NavReading + ReserveState", () => {
    const n = NavReadingSchema.assert({ loan: 1, navBps: 10000, observedAt: 1_700_000_000, source: "servicer" });
    expect(n.navBps).toBe(10000);
    const r = ReserveStateSchema.assert({ balance: "1000000000000", updatedAt: 1 });
    expect(r.balance).toBe(1_000_000_000_000n);
  });
});

// #14 each schema rejects >=1 malformed fixture.
describe("arktype schemas reject malformed fixtures", () => {
  test("Loan rejects unknown status", () => {
    expect(() => LoanSchema.assert({ id: 1, principal: "1", rateBps: 1, status: "Active", startedAt: 1, collateralType: "CRE", propertyId: 1, ltvBps: 1, dscrBps: 1 })).toThrow();
  });
  test("Loan rejects unknown collateralType", () => {
    expect(() => LoanSchema.assert({ id: 1, principal: "1", rateBps: 1, status: "PERFORMING", startedAt: 1, collateralType: "AUTO", propertyId: 1, ltvBps: 1, dscrBps: 1 })).toThrow();
  });
  test("Identity rejects bad address", () => {
    expect(() => IdentitySchema.assert({ addr: "0xnothex", verified: true })).toThrow();
  });
  test("Usdc6 rejects a decimal string (the dollars-vs-base-units landmine)", () => {
    expect(() => ReserveStateSchema.assert({ balance: "1000.50", updatedAt: 1 })).toThrow();
  });
  test("NavReading rejects out-of-range bps", () => {
    expect(() => NavReadingSchema.assert({ loan: 1, navBps: 2_000_000, observedAt: 1, source: "x" })).toThrow();
  });
  test("ChainEvent rejects unknown event name", () => {
    expect(() => ChainEventSchema.assert({ id: { txHash: "0x" + "a".repeat(64), logIndex: 0 }, name: "Frobnicate", blockNumber: 1n, logIndex: 0, token: "0x" + "1".repeat(40) })).toThrow();
  });
});

// #14 serialization guard: Usdc6 above 2^53 round-trips losslessly through strings.
test("Usdc6 round-trips above 2^53 without precision loss", () => {
  const big: Usdc6 = usdc6(10n ** 24n);
  const back = usdc6FromString(usdc6ToString(big));
  expect(back).toBe(big);
  expect(back).toBe(1_000_000_000_000_000_000_000_000n);
});

// #14 union closure: an exhaustive switch over DomainError['kind'] with no default
// compiles (the assertNever arm would be a compile error if a variant were missing).
test("DomainError union is closed (exhaustive switch compiles)", () => {
  const classify = (e: DomainError): string => {
    switch (e.kind) {
      case "ReceiverNotVerified":
      case "InsufficientReserve":
      case "ExceedsPrincipal":
        return "revert";
      case "NavAnomaly":
      case "ReconMismatch":
        return "halt";
      default:
        return assertNever(e);
    }
  };
  expect(classify({ kind: "ReceiverNotVerified" })).toBe("revert");
  expect(classify({ kind: "ReconMismatch" })).toBe("halt");
});

// #14 NEGATIVE-TYPE FIXTURE: a raw bigint is not assignable to a Usdc6 parameter — the
// nominal brand makes this a compile error, proving Usdc6 != bigint structurally.
test("branded scalars are nominal (compile-time)", () => {
  const takesUsdc6 = (_v: Usdc6): void => {};
  // @ts-expect-error a raw bigint must NOT satisfy the branded Usdc6 parameter
  takesUsdc6(5n);
  takesUsdc6(usdc6(5n)); // the constructor is the only way in
  expect(true).toBe(true);
});
