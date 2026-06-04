// The Seam · reconciliation engine types · #18
// One machine, three layers: the snapshot pulls the on-chain layer (supply/claimable/reserve)
// and the asset+money read models (positions/identities/nav) into a single typed value the 4
// pure invariants verdict over. All money is Usdc6 in identical 6-decimal base units (the I2
// landmine: dollars vs base units, or a JSON-widened bigint, is a phantom ReconMismatch).
import type { Bps, IdentityAddr, LoanId, Usdc6 } from "@pcl/shared";

// #18 the 4 invariant identifiers (typed, never stringly compared at call sites).
export type InvariantId = "SupplyBacked" | "ClaimableCovered" | "NavInBounds" | "IdentityValid";

// #18 one holder's on-chain + off-chain facts for a loan series.
export interface HolderFacts {
  loan: LoanId;
  holder: IdentityAddr;
  principal: Usdc6; // off-chain projected token balance (positions.principal)
  onchainClaimable: Usdc6; // on-chain CreditToken.claimable(holder)
}

// #18 one identity's compliance claims (the I4 check reads these).
export interface IdentityFacts {
  addr: IdentityAddr;
  verified: boolean;
  frozen: boolean;
}

// #18 the immutable input to every invariant — snapshot in, verdict out (pure).
export interface ReconSnapshot {
  // I1: on-chain total supply summed across tokens vs the off-chain backed principal.
  onchainTotalSupply: Usdc6;
  offchainBackedPrincipal: Usdc6; // sum(positions.principal)
  // I2: aggregate on-chain claimable vs off-chain collected cash (the reserve).
  onchainClaimableTotal: Usdc6;
  offchainCollected: Usdc6; // reserve.balance (off-chain read model)
  // I3: loans whose latest accepted NAV is anomalous (frozen). Empty == all in bounds.
  anomalousLoans: LoanId[];
  // I4: holders currently holding (principal > 0) and the identity claims to validate them.
  holders: HolderFacts[];
  identities: Map<IdentityAddr, IdentityFacts>;
  // carried for detail/UI; not all invariants read it.
  navByLoan: Map<LoanId, Bps>;
}

// #18 an invariant verdict.
export type InvariantResult = { ok: true } | { ok: false; failed: InvariantId; detail: unknown };

// #18 a full reconciliation-cycle result: a deterministic stateHash on success; on failure the
// typed engine state (NavAnomaly if I3, else ReconMismatch) + the named failed invariant.
import type { EngineState } from "@pcl/shared";
export type ReconResult =
  | { ok: true; stateHash: string }
  | { ok: false; state: EngineState; failed: InvariantId; detail: unknown };

// #18 thrown by assertCanDistribute when a halt is active — makes the HALT block the claim
// path (ticket 21), not merely log.
export class DistributionHalted extends Error {
  constructor(readonly state: EngineState | "Unknown", readonly failed?: InvariantId) {
    super(`distribution halted: ${state}${failed ? ` (${failed})` : ""}`);
    this.name = "DistributionHalted";
  }
}
