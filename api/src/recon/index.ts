// Reconciliation engine barrel · #18
export { I1_supplyBacked, I2_claimableCovered, I3_navInBounds, I4_identityValid, INVARIANTS, evaluateInvariants } from "./invariants.ts";
export { loadSnapshot, type SnapshotManifest } from "./snapshot.ts";
export { runReconCycle, snapshotHash, setStateHasher } from "./engine.ts";
export { isDistributionHalted, assertCanDistribute } from "./halt.ts";
export {
  DistributionHalted,
  type InvariantId,
  type InvariantResult,
  type ReconResult,
  type ReconSnapshot,
  type HolderFacts,
  type IdentityFacts,
} from "./types.ts";
