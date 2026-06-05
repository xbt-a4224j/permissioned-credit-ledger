// The Seam · GraphQL ReconciliationStatus — the marquee as a first-class query · #20
// Surfaces the latest reconciliation cycle (#18): the typed ReconState (OK/HALTED), the four
// named invariant verdicts (1:1 with the engine's I1-I4), and — when HALTED — the typed
// haltReason (NavAnomaly for an I3 break, else ReconMismatch). InvariantResult carries the
// on-chain/off-chain values + delta as BigIntStr for the health panel (#26).
import { builder } from "../builder.ts";
import { ReasonCode, ReconState, type ReasonCodeValue } from "../enums.ts";

// #20 one invariant's verdict. The four `name`s: supplyBacked, claimableCovered, navInBounds,
// identityValid — exactly the engine's four invariants (#18).
export interface InvariantResultSource {
  name: string;
  ok: boolean;
  onchain: string | null;
  offchain: string | null;
  delta: string | null;
}

export const InvariantResult = builder.simpleObject("InvariantResult", {
  fields: (t) => ({
    name: t.string({ nullable: false }),
    ok: t.boolean({ nullable: false }),
    onchain: t.field({ type: "BigIntStr", nullable: true }),
    offchain: t.field({ type: "BigIntStr", nullable: true }),
    delta: t.field({ type: "BigIntStr", nullable: true }),
  }),
});

// #20 the full cycle verdict. haltReason is null while OK; a ReasonCode while HALTED.
export interface ReconciliationStatusSource {
  state: "OK" | "HALTED";
  cycle: number;
  checkedAt: Date;
  invariants: InvariantResultSource[];
  haltReason: ReasonCodeValue | null;
}

export const ReconciliationStatus = builder.simpleObject("ReconciliationStatus", {
  fields: (t) => ({
    state: t.field({ type: ReconState, nullable: false }),
    cycle: t.int({ nullable: false }),
    checkedAt: t.field({ type: "DateTime", nullable: false }),
    invariants: t.field({ type: [InvariantResult], nullable: false }),
    haltReason: t.field({ type: ReasonCode, nullable: true }),
  }),
});
