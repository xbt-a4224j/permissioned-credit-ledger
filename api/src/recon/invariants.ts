// The 4 reconciliation invariants (pure predicates) · #18
// The core of the system: continuously proving the token is still backed and refusing to distribute when
// it can't be. Each invariant is snapshot-in/verdict-out (no I/O) so the same functions run in
// the live engine and inside deterministic replay (#19). All money compares Usdc6 to Usdc6 in
// identical base units. Evaluated in a FIXED order so the recorded failed_invariant is
// deterministic (a flaky order would make matrix row 10 flaky in CI).
import type { ReconSnapshot, InvariantResult } from "./types.ts";

// #18 I1 — on-chain total supply equals the off-chain backed principal. A drift means the
// indexer's projection and the chain disagree on how much token exists (the book is wrong).
export function I1_supplyBacked(s: ReconSnapshot): InvariantResult {
  if (s.onchainTotalSupply === s.offchainBackedPrincipal) return { ok: true };
  return {
    ok: false,
    failed: "SupplyBacked",
    detail: { onchainTotalSupply: s.onchainTotalSupply.toString(), offchainBackedPrincipal: s.offchainBackedPrincipal.toString() },
  };
}

// #18 I2 — aggregate on-chain claimable must be COVERED by off-chain collected cash. This is
// the solvency gate: if holders can claim more than the servicer actually collected, the
// system would pay money that isn't there. Matrix row 10 breaks this (inject cash < claimable).
export function I2_claimableCovered(s: ReconSnapshot): InvariantResult {
  if (s.onchainClaimableTotal <= s.offchainCollected) return { ok: true };
  return {
    ok: false,
    failed: "ClaimableCovered",
    detail: { onchainClaimableTotal: s.onchainClaimableTotal.toString(), offchainCollected: s.offchainCollected.toString() },
  };
}

// #18 I3 — every active loan's latest accepted NAV is non-anomalous. A loan under a NavAnomaly
// halt (#17) must not drive distribution. This is the invariant whose engine state is
// 'NavAnomaly' rather than 'ReconMismatch'.
export function I3_navInBounds(s: ReconSnapshot): InvariantResult {
  if (s.anomalousLoans.length === 0) return { ok: true };
  return { ok: false, failed: "NavInBounds", detail: { anomalousLoans: s.anomalousLoans } };
}

// #18 I4 — every current holder is verified and not frozen (compliance-eligible). A frozen or
// unverified holder on the book is an identity break the gauntlet should never have allowed.
export function I4_identityValid(s: ReconSnapshot): InvariantResult {
  for (const h of s.holders) {
    const id = s.identities.get(h.holder);
    if (id === undefined || !id.verified || id.frozen) {
      return { ok: false, failed: "IdentityValid", detail: { holder: h.holder, loan: h.loan, claims: id ?? null } };
    }
  }
  return { ok: true };
}

// #18 the fixed-order invariant list; the engine + replay both fold over this exact order.
export const INVARIANTS = [I1_supplyBacked, I2_claimableCovered, I3_navInBounds, I4_identityValid] as const;

// #18 evaluate all 4 in order, short-circuiting on the first failure (deterministic verdict).
export function evaluateInvariants(s: ReconSnapshot): InvariantResult {
  for (const inv of INVARIANTS) {
    const r = inv(s);
    if (!r.ok) return r;
  }
  return { ok: true };
}
