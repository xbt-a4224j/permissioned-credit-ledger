// The Seam · reconciliation read model for the API · #21
// The marquee is a first-class query. readReconStatus folds the latest recon cycle (#18) +
// its four named invariants into the GraphQL ReconciliationStatus shape (#20). It also exposes
// the halt verdict the mutation gate (#21) reads BEFORE touching the chain, so a HALTED engine
// refuses to distribute (matrix rows 9-10) rather than just lighting a UI banner. Read-only:
// resolvers never compute a cycle, they only read what the engine committed.
import type { EngineState, ReasonCode, Sql } from "@pcl/shared";

// #21 the typed halt reason: an off-chain engine state (the recon_status.state column). Kept as
// a named alias so the GraphQL ReasonCode enum (7 values) and this read model line up.
type HaltReason = ReasonCode | EngineState;

// #21 the GraphQL InvariantResult source (one per #18 invariant). All money is a decimal string.
export interface InvariantResultRow {
  name: "supplyBacked" | "claimableCovered" | "navInBounds" | "identityValid";
  ok: boolean;
  onchain: string | null;
  offchain: string | null;
  delta: string | null;
}

// #21 the GraphQL ReconciliationStatus source.
export interface ReconStatusView {
  state: "OK" | "HALTED";
  cycle: number;
  checkedAt: Date;
  invariants: InvariantResultRow[];
  haltReason: HaltReason | null;
}

// #21 the four invariant names the schema declares (#20), 1:1 with the engine's I1-I4 (#18).
const INVARIANT_NAMES: InvariantResultRow["name"][] = ["supplyBacked", "claimableCovered", "navInBounds", "identityValid"];

// #18 InvariantId -> #20 camelCase invariant name (the engine names them PascalCase).
const FAILED_TO_NAME: Record<string, InvariantResultRow["name"]> = {
  SupplyBacked: "supplyBacked",
  ClaimableCovered: "claimableCovered",
  NavInBounds: "navInBounds",
  IdentityValid: "identityValid",
};

// #21 read the latest reconciliation cycle as the GraphQL status. When no cycle has run yet,
// report OK with all four invariants green (the genesis read model is consistent by construction).
export async function readReconStatus(sql: Sql): Promise<ReconStatusView> {
  const rows = await sql<
    { cycle_id: bigint; ran_at: Date; ok: boolean; state: string | null; failed_invariant: string | null }[]
  >`
    select cycle_id, ran_at, ok, state, failed_invariant
    from recon_status order by cycle_id desc limit 1
  `;
  const last = rows[0];

  if (last === undefined) {
    return {
      state: "OK",
      cycle: 0,
      checkedAt: new Date(0),
      invariants: INVARIANT_NAMES.map((name) => ({ name, ok: true, onchain: null, offchain: null, delta: null })),
      haltReason: null,
    };
  }

  // a failed cycle names exactly one breaking invariant; the typed engine state is the halt reason.
  const failedName = last.failed_invariant !== null ? FAILED_TO_NAME[last.failed_invariant] : undefined;
  const invariants = INVARIANT_NAMES.map((name) => ({
    name,
    ok: last.ok || name !== failedName,
    onchain: null,
    offchain: null,
    delta: null,
  }));

  return {
    state: last.ok ? "OK" : "HALTED",
    cycle: Number(last.cycle_id),
    checkedAt: last.ran_at,
    invariants,
    haltReason: last.ok ? null : ((last.state ?? "ReconMismatch") as HaltReason),
  };
}

// #21 the recon reader handle on the context (lets resolvers + the HALT gate share one read).
export interface ReconReader {
  read(): Promise<ReconStatusView>;
}
