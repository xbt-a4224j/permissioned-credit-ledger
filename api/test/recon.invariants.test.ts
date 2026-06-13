// #18 each invariant fails independently with its own InvariantId; all-green passes.
// Pure snapshot-in/verdict-out — no DB, no chain. Proves the 4 invariants are isolable and the
// fixed evaluation order yields a deterministic failed_invariant.
import { describe, expect, test } from "vitest";
import { identityAddr, loanId, usdc6, type IdentityAddr, type LoanId } from "@pcl/shared";
import {
  I1_supplyBacked,
  I2_claimableCovered,
  I3_navInBounds,
  I4_identityValid,
  evaluateInvariants,
} from "../src/recon/invariants.ts";
import type { ReconSnapshot, IdentityFacts } from "../src/recon/types.ts";

const A: IdentityAddr = identityAddr("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
const LOAN: LoanId = loanId(1);

// a fully-consistent baseline snapshot (every invariant holds).
function baseSnapshot(): ReconSnapshot {
  const identities = new Map<IdentityAddr, IdentityFacts>([[A, { addr: A, verified: true }]]);
  return {
    onchainTotalSupply: usdc6(100_000n),
    offchainBackedPrincipal: usdc6(100_000n),
    onchainClaimableTotal: usdc6(500n),
    offchainCollected: usdc6(1000n), // covers claimable
    anomalousLoans: [],
    holders: [{ loan: LOAN, holder: A, principal: usdc6(100_000n), onchainClaimable: usdc6(500n) }],
    identities,
    navByLoan: new Map(),
  };
}

test("all-green snapshot -> ok", () => {
  expect(evaluateInvariants(baseSnapshot())).toEqual({ ok: true });
});

describe("each invariant fails independently with its InvariantId", () => {
  test("I1 SupplyBacked: supply != backed", () => {
    const s = { ...baseSnapshot(), onchainTotalSupply: usdc6(99_999n) };
    const r = I1_supplyBacked(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failed).toBe("SupplyBacked");
    // and the cycle surfaces it (I1 is first).
    expect(evaluateInvariants(s)).toMatchObject({ ok: false, failed: "SupplyBacked" });
  });

  test("I2 ClaimableCovered: claimable > collected", () => {
    const s = { ...baseSnapshot(), onchainClaimableTotal: usdc6(2000n), offchainCollected: usdc6(1000n) };
    const r = I2_claimableCovered(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failed).toBe("ClaimableCovered");
  });

  test("I3 NavInBounds: an anomalous loan (engine maps this to NavAnomaly)", () => {
    const s = { ...baseSnapshot(), anomalousLoans: [LOAN] };
    const r = I3_navInBounds(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failed).toBe("NavInBounds");
  });

  test("I4 IdentityValid: an unverified holder", () => {
    const identities = new Map<IdentityAddr, IdentityFacts>([[A, { addr: A, verified: false }]]);
    const r = I4_identityValid({ ...baseSnapshot(), identities });
    expect(r.ok).toBe(false);
  });
});

test("invariants are pure: identical snapshot -> identical verdict", () => {
  const s = { ...baseSnapshot(), onchainClaimableTotal: usdc6(2000n), offchainCollected: usdc6(1000n) };
  expect(evaluateInvariants(s)).toEqual(evaluateInvariants(s));
});
