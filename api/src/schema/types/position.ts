// GraphQL Position type — a holder's stake in a loan · #20
// principal is the token balance; accrued/claimable mirror on-chain interest the recon engine
// (#18) bounds by collected cash. Positions are the indexer-projected `positions` read model — the
// single source of truth (#66 removed the pre-confirmation optimistic layer; a fresh invest's
// position appears within a block + an index cycle). Money fields BigIntStr.
import { builder } from "../builder.ts";

// #20 the resolver-produced Position source (a canonical, indexer-projected row).
export interface PositionSource {
  id: string;
  holder: string;
  loanId: string;
  principal: string;
  accrued: string;
  claimable: string;
  lastAccrualAt: Date;
}

export const Position = builder.simpleObject("Position", {
  fields: (t) => ({
    id: t.id({ nullable: false }),
    holder: t.field({ type: "Address", nullable: false }),
    loanId: t.id({ nullable: false }),
    principal: t.field({ type: "BigIntStr", nullable: false }),
    accrued: t.field({ type: "BigIntStr", nullable: false }),
    claimable: t.field({ type: "BigIntStr", nullable: false }),
    lastAccrualAt: t.field({ type: "DateTime", nullable: false }),
  }),
});
