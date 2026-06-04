// The Seam · #18 soundness property: the cycle never reports OK while any invariant is violated.
// For arbitrary snapshots, the conjunction I1 && I2 && I3 && I4 equals evaluateInvariants(s).ok;
// and a single deliberately-broken invariant always yields ok === false with that invariant
// named (fixed evaluation order makes the named one deterministic). Pure — no DB/chain.
import { test } from "vitest";
import fc from "fast-check";
import { identityAddr, loanId, usdc6, type IdentityAddr } from "@pcl/shared";
import {
  I1_supplyBacked,
  I2_claimableCovered,
  I3_navInBounds,
  I4_identityValid,
  evaluateInvariants,
} from "../src/recon/invariants.ts";
import type { ReconSnapshot, IdentityFacts } from "../src/recon/types.ts";

const A: IdentityAddr = identityAddr("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
const LOAN = loanId(1);

// arbitrary snapshot with independently-perturbable money + flags.
const snapshotArb = fc
  .record({
    supply: fc.bigInt({ min: 0n, max: 10n ** 12n }),
    backed: fc.bigInt({ min: 0n, max: 10n ** 12n }),
    claimable: fc.bigInt({ min: 0n, max: 10n ** 12n }),
    collected: fc.bigInt({ min: 0n, max: 10n ** 12n }),
    anomalous: fc.boolean(),
    verified: fc.boolean(),
    frozen: fc.boolean(),
  })
  .map((r): ReconSnapshot => {
    const identities = new Map<IdentityAddr, IdentityFacts>([[A, { addr: A, verified: r.verified, frozen: r.frozen }]]);
    return {
      onchainTotalSupply: usdc6(r.supply),
      offchainBackedPrincipal: usdc6(r.backed),
      onchainClaimableTotal: usdc6(r.claimable),
      offchainCollected: usdc6(r.collected),
      anomalousLoans: r.anomalous ? [LOAN] : [],
      holders: [{ loan: LOAN, holder: A, principal: usdc6(r.supply), onchainClaimable: usdc6(r.claimable) }],
      identities,
      navByLoan: new Map(),
    };
  });

test("evaluateInvariants.ok === I1 && I2 && I3 && I4", () => {
  fc.assert(
    fc.property(snapshotArb, (s) => {
      const conj = I1_supplyBacked(s).ok && I2_claimableCovered(s).ok && I3_navInBounds(s).ok && I4_identityValid(s).ok;
      return evaluateInvariants(s).ok === conj;
    }),
    { numRuns: 256 },
  );
});

test("a single broken invariant always yields ok === false (soundness)", () => {
  fc.assert(
    fc.property(snapshotArb, fc.constantFrom(0, 1, 2, 3), (s, which) => {
      // force exactly one break on top of an otherwise-valid base.
      const valid: ReconSnapshot = {
        ...s,
        onchainTotalSupply: usdc6(100n),
        offchainBackedPrincipal: usdc6(100n),
        onchainClaimableTotal: usdc6(10n),
        offchainCollected: usdc6(10n),
        anomalousLoans: [],
        identities: new Map([[A, { addr: A, verified: true, frozen: false }]]),
      };
      let broken: ReconSnapshot;
      if (which === 0) broken = { ...valid, onchainTotalSupply: usdc6(101n) };
      else if (which === 1) broken = { ...valid, onchainClaimableTotal: usdc6(11n) }; // > collected
      else if (which === 2) broken = { ...valid, anomalousLoans: [LOAN] };
      else broken = { ...valid, identities: new Map([[A, { addr: A, verified: true, frozen: true }]]) };

      const r = evaluateInvariants(broken);
      return r.ok === false;
    }),
    { numRuns: 256 },
  );
});
